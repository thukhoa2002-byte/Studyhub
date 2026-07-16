import express from "express";

import { getOpenAIClient } from "../config/openai.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const cache = new Map();
const OPEN_FDA_LABEL_URL = "https://api.fda.gov/drug/label.json";

function firstText(value) {
  if (!Array.isArray(value)) return "";
  return value.filter(Boolean).join("\n\n").trim();
}

function compactSection(value, maxLength = 4500) {
  const text = firstText(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function firstOpenFdaValue(label, key) {
  const value = label?.openfda?.[key];
  return Array.isArray(value) && value.length ? value[0] : "";
}

function normalizeDrugName(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

function chooseBestLabel(results, query) {
  const normalizedQuery = normalizeDrugName(query);
  return results.find((label) => ["generic_name", "brand_name", "substance_name"].some((key) => {
    const names = label?.openfda?.[key];
    return Array.isArray(names) && names.some((name) => normalizeDrugName(name) === normalizedQuery);
  })) || results[0];
}

async function fetchOfficialLabel(query) {
  const safeQuery = query.replace(/["\\]/g, " ").trim();
  const exactQuery = safeQuery.toLocaleUpperCase("en");
  const searches = [
    `openfda.generic_name.exact:"${exactQuery}"`,
    `openfda.brand_name.exact:"${exactQuery}"`,
    `openfda.substance_name.exact:"${exactQuery}"`,
    `(openfda.generic_name:"${safeQuery}" OR openfda.brand_name:"${safeQuery}" OR openfda.substance_name:"${safeQuery}")`,
  ];

  for (const search of searches) {
    const url = new URL(OPEN_FDA_LABEL_URL);
    url.searchParams.set("search", search);
    url.searchParams.set("limit", "10");

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error("Nguồn nhãn thuốc openFDA đang tạm thời không phản hồi.");

    const payload = await response.json();
    if (payload?.results?.[0]) return chooseBestLabel(payload.results, query);
  }

  return null;
}

router.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ success: false, message: "Hãy nhập tên thuốc hợp lệ." });
  }

  const cacheKey = query.toLocaleLowerCase("vi");
  if (cache.has(cacheKey)) {
    return res.json({ ...cache.get(cacheKey), aiCallsRemaining: getAiCallsRemaining(), cached: true });
  }

  try {
    const label = await fetchOfficialLabel(query);
    if (!label) {
      return res.status(404).json({ success: false, message: `Không tìm thấy nhãn thuốc “${query}”. Hãy thử tên hoạt chất bằng tiếng Anh.` });
    }

    const sourceSections = {
      indications: compactSection(label.indications_and_usage),
      contraindications: compactSection(label.contraindications),
      dosage: compactSection(label.dosage_and_administration),
      mechanism: compactSection(label.mechanism_of_action?.length ? label.mechanism_of_action : label.clinical_pharmacology),
      liverKidney: [
        compactSection(label.pharmacokinetics),
        compactSection(label.use_in_specific_populations),
      ].filter(Boolean).join("\n\n"),
    };

    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) {
      return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    }

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      max_output_tokens: 2600,
      input: [{
        role: "user",
        content: [{
          type: "input_text",
          text: [
            "Bạn là trợ lý dược lý cho bác sĩ ôn thi Nội trú.",
            "Dịch và tóm tắt nhãn thuốc tiếng Anh bên dưới sang tiếng Việt, chỉ giữ đúng 5 mục trong schema.",
            "Không bổ sung kiến thức ngoài nhãn, không suy đoán, không tự tạo liều.",
            "Giữ nguyên số, đơn vị, đường dùng và đối tượng dùng thuốc.",
            "Mục chuyển hóa gan thận phải nêu chuyển hóa, thải trừ và điều chỉnh liều ở suy gan/suy thận nếu nhãn có.",
            "Nếu nguồn của một mục trống hoặc không đủ để kết luận, trả đúng câu: Chưa có thông tin trong nhãn thuốc.",
            "Viết súc tích, ưu tiên các gạch đầu dòng ngắn, không markdown.",
            JSON.stringify(sourceSections),
          ].join("\n\n"),
        }],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "drug_summary",
          strict: true,
          schema: {
            type: "object",
            properties: {
              indications: { type: "array", minItems: 1, items: { type: "string" } },
              contraindications: { type: "array", minItems: 1, items: { type: "string" } },
              dosage: { type: "array", minItems: 1, items: { type: "string" } },
              mechanism: { type: "array", minItems: 1, items: { type: "string" } },
              liverKidney: { type: "array", minItems: 1, items: { type: "string" } },
            },
            required: ["indications", "contraindications", "dosage", "mechanism", "liverKidney"],
            additionalProperties: false,
          },
        },
      },
    });

    const summary = response.output_parsed || JSON.parse(response.output_text);
    const setId = label.set_id || firstOpenFdaValue(label, "spl_set_id");
    const payload = {
      success: true,
      drug: {
        query,
        genericName: firstOpenFdaValue(label, "generic_name") || firstOpenFdaValue(label, "substance_name") || query,
        brandName: firstOpenFdaValue(label, "brand_name"),
        manufacturer: firstOpenFdaValue(label, "manufacturer_name"),
        route: Array.isArray(label?.openfda?.route) ? label.openfda.route : [],
        effectiveTime: label.effective_time || "",
        summary,
        sourceUrl: setId
          ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`
          : "https://open.fda.gov/apis/drug/label/",
      },
      aiCallsRemaining,
    };

    cache.set(cacheKey, payload);
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return res.json(payload);
  } catch (error) {
    console.error("Drug lookup failed:", error);
    return res.status(500).json({ success: false, message: error.message || "Không thể tra cứu thuốc lúc này." });
  }
});

export default router;
