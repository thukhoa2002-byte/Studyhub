import type { CalculatorResult, IndexingStatus } from "./platformTypes.ts";

export type ReferenceToolCalculatorType = "bmi" | "egfr" | "crcl" | "holliday-segar" | "bsa" | "wells-pe" | "cha2ds2-vasc" | "child-pugh" | "timi" | "has-bled" | "centor" | "sirs" | "grace-acs" | "anion-gap" | "psi-port" | "curb-65" | "apache-ii";
export type ReferenceEgfrMethod = "creatinine" | "cystatin" | "combined" | "mdrd";
export type ReferenceCrclVariant = "actual-body-weight" | "ideal-body-weight" | "adjusted-body-weight" | "bsa-normalized";
export type ReferenceField = { key: string; label: string; placeholder?: string; options?: Array<{ value: string; label: string }> };
export type ReferenceInputValues = Record<string, string>;
export interface ReferenceFormulaDefinition {
  title: string;
  description: string;
  formula: string;
  variables: string;
  source: string;
  sourceLabel: string;
  parameterLayout?: "ckd-epi-creatinine-2021" | "ckd-epi-combined-2012";
}

export const calculatorSourceLinks = {
  niddk: "https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/estimating-gfr-equations",
  kdigo: "https://kdigo.org/wp-content/uploads/2017/02/KDIGO_2012_CKD_GL.pdf",
  cockcroftGault: "https://pubmed.ncbi.nlm.nih.gov/4830801/",
  hollidaySegar: "https://pubmed.ncbi.nlm.nih.gov/13431307/",
} as const;

const referenceFormulaDefinitions: Partial<Record<ReferenceToolCalculatorType, ReferenceFormulaDefinition>> = {
  bsa: { title: "BSA · Body Surface Area", description: "Diện tích da cơ thể theo công thức Mosteller", formula: "BSA (m<sup>2</sup>) = √[(Chiều cao (cm) × Cân nặng (kg)) / 3600]", variables: "Dùng chiều cao theo cm và cân nặng theo kg.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=Mosteller+body+surface+area+formula", sourceLabel: "Mosteller · PubMed" },
  "wells-pe": { title: "Wells' Score · Pulmonary Embolism", description: "Thang điểm Wells đánh giá khả năng thuyên tắc phổi", formula: "Dấu hiệu DVT 3 điểm; PE có khả năng nhất 3; nhịp tim >100 1.5; bất động/phẫu thuật 4 tuần 1.5; tiền sử DVT/PE 1.5; ho ra máu 1; ung thư 1.<br />Tổng điểm ≤4: PE unlikely; >4: PE likely.", variables: "Đây là phiên bản Wells cho PE; cần kết hợp xác suất trước xét nghiệm và hướng dẫn chẩn đoán.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=Wells+clinical+model+pulmonary+embolism", sourceLabel: "Wells PE · PubMed" },
  "cha2ds2-vasc": { title: "CHA₂DS₂-VASc Score", description: "Nguy cơ đột quỵ ở bệnh nhân rung nhĩ", formula: "C: suy tim 1; H: tăng huyết áp 1; A<sub>2</sub>: tuổi ≥75 là 2; D: đái tháo đường 1; S<sub>2</sub>: đột quỵ/TIA/thuyên tắc 2; V: bệnh mạch máu 1; A: tuổi 65–74 là 1; Sc: nữ 1.", variables: "Tổng điểm dùng để phân tầng nguy cơ và quyết định điều trị theo hướng dẫn rung nhĩ.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=CHA2DS2-VASc+score+atrial+fibrillation", sourceLabel: "CHA₂DS₂-VASc · PubMed" },
  "child-pugh": { title: "Child-Pugh Score", description: "Đánh giá mức độ nặng bệnh gan mạn", formula: "5 tiêu chí, mỗi tiêu chí 1–3 điểm: bilirubin, albumin, INR/thời gian prothrombin, cổ trướng và bệnh não gan.<br />A: 5–6; B: 7–9; C: 10–15 điểm.", variables: "Ngưỡng bilirubin có thể khác trong bệnh ứ mật; cần dùng bảng tiêu chuẩn của chuyên ngành gan mật.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=Child-Pugh+score+cirrhosis", sourceLabel: "Child-Pugh · PubMed" },
  timi: { title: "TIMI Risk Score · UA/NSTEMI", description: "Nguy cơ biến cố tim mạch trong hội chứng vành cấp", formula: "7 yếu tố, mỗi yếu tố 1 điểm: tuổi ≥65; ≥3 yếu tố nguy cơ CAD; CAD đã biết ≥50%; dùng aspirin trong 7 ngày; ≥2 cơn đau ngực trong 24 giờ; ST chênh ≥0.5 mm; biomarker tim tăng.", variables: "Tổng điểm 0–7; đây là phiên bản TIMI cho UA/NSTEMI, không phải TIMI STEMI.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=TIMI+risk+score+unstable+angina+non-ST-segment", sourceLabel: "TIMI · PubMed" },
  "has-bled": { title: "HAS-BLED Score", description: "Nguy cơ chảy máu ở bệnh nhân rung nhĩ", formula: "H: tăng huyết áp 1; A: bất thường thận 1 + gan 1; S: tiền sử đột quỵ 1; B: chảy máu 1; L: INR không ổn định 1; E: tuổi >65 1; D: thuốc 1 + rượu 1.", variables: "Điểm tối đa 9; điểm cao là tín hiệu cần rà soát yếu tố nguy cơ, không tự động chống chỉ định chống đông.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=HAS-BLED+score+atrial+fibrillation", sourceLabel: "HAS-BLED · PubMed" },
  centor: { title: "Centor / McIsaac Score", description: "Khả năng viêm họng do liên cầu nhóm A", formula: "Không ho 1; hạch cổ trước đau 1; sốt 1; amidan xuất tiết/sưng 1; tuổi 3–14 cộng 1; tuổi 15–44 cộng 0; tuổi ≥45 trừ 1.", variables: "Điểm dùng để hỗ trợ quyết định xét nghiệm liên cầu, không thay thế thăm khám.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=McIsaac+modified+Centor+score", sourceLabel: "Centor/McIsaac · PubMed" },
  sirs: { title: "SIRS Criteria", description: "Tiêu chuẩn đáp ứng viêm hệ thống", formula: "Nhiệt độ >38°C hoặc <36°C; nhịp tim >90/phút; nhịp thở >20/phút hoặc PaCO₂ <32 mmHg; bạch cầu >12.000 hoặc <4.000/mm<sup>3</sup> hoặc band >10%.<br />SIRS ≥2 tiêu chí.", variables: "SIRS không đồng nghĩa với sepsis; cần đánh giá theo định nghĩa và hướng dẫn hiện hành.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=ACCP+SCCM+SIRS+criteria+1992", sourceLabel: "ACCP/SCCM · PubMed" },
  "grace-acs": { title: "GRACE ACS Score", description: "Nguy cơ tử vong hoặc nhồi máu cơ tim trong ACS", formula: "Điểm GRACE là mô hình đa biến gồm: tuổi, nhịp tim, huyết áp tâm thu, creatinine, Killip class, ngừng tim lúc nhập viện, ST chênh và biomarker tim.", variables: "Cần dùng bảng điểm/ứng dụng GRACE chuẩn; không nên tự cộng điểm tuyến tính vì mỗi biến có trọng số riêng.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=GRACE+score+acute+coronary+syndrome", sourceLabel: "GRACE · PubMed" },
  "anion-gap": { title: "Anion Gap", description: "Khoảng trống anion trong huyết thanh", formula: "AG = Na<sup>+</sup> − (Cl<sup>−</sup> + HCO<sub>3</sub><sup>−</sup>)<br />AG hiệu chỉnh albumin = AG + 2.5 × (4 − Albumin g/dL).", variables: "Có thể dùng công thức không gồm kali; cần thống nhất với labo và đơn vị xét nghiệm.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=anion+gap+albumin+correction", sourceLabel: "Anion gap · PubMed" },
  "psi-port": { title: "PSI / PORT Score", description: "Tiên lượng viêm phổi mắc phải cộng đồng", formula: "PSI cộng điểm theo 20 biến: nhân khẩu học, bệnh đồng mắc, triệu chứng khám, xét nghiệm và X-quang; sau đó phân lớp I–V.", variables: "PSI là bảng điểm có trọng số, không phải một phương trình ngắn; cần bảng PORT chuẩn để tránh sai điểm.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=Fine+PSI+PORT+score+pneumonia", sourceLabel: "PSI/PORT · PubMed" },
  "curb-65": { title: "CURB-65 Score", description: "Đánh giá mức độ nặng viêm phổi cộng đồng", formula: "C: lú lẫn 1; U: ure >7 mmol/L 1; R: nhịp thở ≥30 1; B: HA tâm thu <90 hoặc tâm trương ≤60 mmHg 1; 65: tuổi ≥65 1.", variables: "Tổng điểm 0–5; diễn giải theo hướng dẫn địa phương và tình trạng lâm sàng.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=CURB-65+score+pneumonia", sourceLabel: "CURB-65 · PubMed" },
  "apache-ii": { title: "APACHE II Score", description: "Đánh giá mức độ nặng bệnh nhân hồi sức", formula: "APACHE II = Acute Physiology Score (12 biến sinh lý) + điểm tuổi + điểm bệnh mạn nặng/suy giảm miễn dịch.", variables: "12 biến gồm dấu hiệu sinh tồn, oxygenation, pH động mạch, Na, K, creatinine, hematocrit, WBC và GCS; lấy giá trị xấu nhất trong 24 giờ đầu ICU.", source: "https://pubmed.ncbi.nlm.nih.gov/?term=APACHE+II+Knaus+1985", sourceLabel: "APACHE II · PubMed" },
};

export function getReferenceFormulaDefinition(type: ReferenceToolCalculatorType, egfrMethod: ReferenceEgfrMethod = "creatinine", crclVariant: ReferenceCrclVariant = "actual-body-weight"): ReferenceFormulaDefinition {
  if (type === "egfr") {
    if (egfrMethod === "cystatin") return { title: "CKD-EPI Cystatin C 2012", description: "Độ lọc cầu thận ước tính theo cystatin C", formula: "eGFR = 133 × min(Scys/0.8, 1)<sup>-0.499</sup> × max(Scys/0.8, 1)<sup>-1.328</sup> × 0.996<sup>Tuổi</sup> × (0.932 nếu nữ)", variables: "Scys: cystatin C (mg/L). Kết quả: mL/min/1,73 m².", source: calculatorSourceLinks.niddk, sourceLabel: "NIDDK · CKD-EPI & MDRD" };
    if (egfrMethod === "combined") return { title: "CKD-EPI Creatinine-Cystatin C 2012", description: "Độ lọc cầu thận ước tính theo creatinine và cystatin C", formula: "eGFR = 135 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>-0.601</sup> × min(Scys/0.8, 1)<sup>-0.375</sup> × max(Scys/0.8, 1)<sup>-0.711</sup> × 0.995<sup>Tuổi</sup> × (0.969 nếu nữ)", variables: "Scr: creatinine mg/dL; Scys: cystatin C mg/L; κ=0.9 nam/0.7 nữ; α=-0.207 nam/-0.248 nữ.", source: calculatorSourceLinks.niddk, sourceLabel: "NIDDK · CKD-EPI & MDRD", parameterLayout: "ckd-epi-combined-2012" };
    if (egfrMethod === "mdrd") return { title: "MDRD · Modification of Diet in Renal Disease", description: "Độ lọc cầu thận ước tính theo MDRD 4 biến", formula: "eGFR = 175 × Scr<sup>-1.154</sup> × Tuổi<sup>-0.203</sup> × (0.742 nếu nữ)", variables: "Scr: creatinine mg/dL. Kết quả: mL/min/1,73 m².", source: calculatorSourceLinks.niddk, sourceLabel: "NIDDK · CKD-EPI & MDRD" };
    return { title: "CKD-EPI Creatinine 2021", description: "Độ lọc cầu thận ước tính theo creatinine", formula: "eGFR = 142 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>-1.200</sup> × 0.9938<sup>Tuổi</sup> × (1.012 nếu nữ)", variables: "Scr: creatinine mg/dL; κ=0.9 nam/0.7 nữ; α=-0.302 nam/-0.241 nữ. Kết quả: mL/min/1,73 m².", source: calculatorSourceLinks.niddk, sourceLabel: "NIDDK · CKD-EPI & MDRD", parameterLayout: "ckd-epi-creatinine-2021" };
  }
  if (type === "crcl") {
    if (crclVariant === "adjusted-body-weight") return { title: "Cockcroft-Gault · Adjusted Body Weight", description: "Độ thanh thải creatinine với cân nặng hiệu chỉnh", formula: "CrCl = [(140 − Tuổi) × W / (72 × Scr)] × (0.85 nếu nữ)<br>AdjBW = IBW + 0.4 × (TBW − IBW)", variables: "IBW nam=50+2.3×(inch−60); IBW nữ=45.5+2.3×(inch−60); Scr: mg/dL.", source: calculatorSourceLinks.cockcroftGault, sourceLabel: "Cockcroft-Gault · PubMed" };
    if (crclVariant === "bsa-normalized") return { title: "Creatinine Clearance · BSA-normalized", description: "Độ thanh thải creatinine chuẩn hóa theo diện tích da", formula: "CrCl<sub>1.73</sub> = CrCl × 1.73 / BSA<br>BSA = √[(Chiều cao cm × Cân nặng kg) / 3600]", variables: "Kết quả: mL/min/1,73 m²; dùng để chuẩn hóa so sánh, không thay thế CrCl dùng chỉnh liều.", source: calculatorSourceLinks.cockcroftGault, sourceLabel: "Cockcroft-Gault · PubMed" };
    return { title: "Cockcroft-Gault · Creatinine Clearance", description: "Độ thanh thải creatinine", formula: "CrCl = [(140 − Tuổi) × Cân nặng / (72 × Scr)] × (0.85 nếu nữ)", variables: "Cân nặng kg; Scr: creatinine mg/dL. Kết quả: mL/min.", source: calculatorSourceLinks.cockcroftGault, sourceLabel: "Cockcroft-Gault · PubMed" };
  }
  if (type === "holliday-segar") return { title: "Holliday-Segar · Maintenance Fluid", description: "Dịch duy trì theo cân nặng", formula: "Theo giờ: 4 mL/kg cho 10 kg đầu + 2 mL/kg cho 10 kg tiếp theo + 1 mL/kg cho phần còn lại<br>Theo ngày: 100 mL/kg cho 10 kg đầu + 50 mL/kg cho 10 kg tiếp theo + 20 mL/kg cho phần còn lại", variables: "Dùng để ước tính dịch duy trì ban đầu; cần điều chỉnh theo bệnh cảnh.", source: calculatorSourceLinks.hollidaySegar, sourceLabel: "Holliday-Segar · PubMed" };
  return referenceFormulaDefinitions[type] || { title: "Công thức chưa có nguồn", description: "Chưa có implementation nguồn đã xác minh.", formula: "Chưa có công thức sẵn sàng sử dụng.", variables: "Không tính tự động khi nguồn chưa đủ để xác minh.", source: "", sourceLabel: "Chưa có nguồn" };
}

const binary = [{ value: "0", label: "Không · 0 điểm" }, { value: "1", label: "Có · 1 điểm" }];

export const referenceCalculatorFields: Partial<Record<ReferenceToolCalculatorType, ReferenceField[]>> = {
  bsa: [{ key: "heightCm", label: "Chiều cao (cm)" }, { key: "weightKg", label: "Cân nặng (kg)" }],
  "wells-pe": [
    ["dvt", "Dấu hiệu lâm sàng DVT", "3"], ["peLikely", "PE là chẩn đoán có khả năng nhất", "3"], ["heartRate", "Nhịp tim >100/phút", "1.5"], ["immobilization", "Bất động/phẫu thuật trong 4 tuần", "1.5"], ["historyVte", "Tiền sử DVT/PE", "1.5"], ["hemoptysis", "Ho ra máu", "1"], ["cancer", "Ung thư đang điều trị", "1"],
  ].map(([key, label, points]) => ({ key, label, options: [{ value: "0", label: "Không · 0" }, { value: points, label: `Có · ${points}` }] })),
  "cha2ds2-vasc": [
    ["chf", "Suy tim", "1"], ["hypertension", "Tăng huyết áp", "1"], ["age75", "Tuổi ≥75", "2"], ["diabetes", "Đái tháo đường", "1"], ["stroke", "Đột quỵ/TIA/thuyên tắc", "2"], ["vascular", "Bệnh mạch máu", "1"], ["age65", "Tuổi 65–74", "1"], ["female", "Giới nữ", "1"],
  ].map(([key, label, points]) => ({ key, label, options: points === "1" ? binary : [{ value: "0", label: "Không · 0" }, { value: points, label: `Có · ${points}` }] })),
  "child-pugh": [
    { key: "bilirubin", label: "Bilirubin", options: [{ value: "1", label: "<2 mg/dL · 1" }, { value: "2", label: "2–3 mg/dL · 2" }, { value: "3", label: ">3 mg/dL · 3" }] },
    { key: "albumin", label: "Albumin", options: [{ value: "1", label: ">3,5 g/dL · 1" }, { value: "2", label: "2,8–3,5 g/dL · 2" }, { value: "3", label: "<2,8 g/dL · 3" }] },
    { key: "inr", label: "INR", options: [{ value: "1", label: "<1,7 · 1" }, { value: "2", label: "1,7–2,3 · 2" }, { value: "3", label: ">2,3 · 3" }] },
    { key: "ascites", label: "Cổ trướng", options: [{ value: "1", label: "Không · 1" }, { value: "2", label: "Nhẹ/kiểm soát · 2" }, { value: "3", label: "Vừa-nặng/khó kiểm soát · 3" }] },
    { key: "encephalopathy", label: "Bệnh não gan", options: [{ value: "1", label: "Không · 1" }, { value: "2", label: "Độ I–II · 2" }, { value: "3", label: "Độ III–IV · 3" }] },
  ],
  timi: ["Tuổi ≥65", "≥3 yếu tố nguy cơ CAD", "CAD đã biết ≥50%", "Dùng aspirin trong 7 ngày", "≥2 cơn đau ngực trong 24 giờ", "ST chênh ≥0,5 mm", "Biomarker tim tăng"].map((label, index) => ({ key: ["age65", "riskFactors", "knownCad", "aspirin", "angina", "stDeviation", "biomarker"][index], label, options: binary })),
  "has-bled": ["Tăng huyết áp", "Bất thường thận", "Bất thường gan", "Tiền sử đột quỵ", "Tiền sử chảy máu", "INR không ổn định", "Tuổi >65", "Thuốc làm tăng nguy cơ chảy máu", "Rượu"].map((label, index) => ({ key: ["hypertension", "renal", "liver", "stroke", "bleeding", "labileInr", "age65", "drugs", "alcohol"][index], label, options: binary })),
  centor: ["Không ho", "Hạch cổ trước đau", "Sốt", "Amidan xuất tiết/sưng"].map((label, index) => ({ key: ["noCough", "tenderNodes", "fever", "exudate"][index], label, options: binary })).concat([{ key: "ageAdjustment", label: "Điều chỉnh theo tuổi", options: [{ value: "-1", label: "≥45 tuổi · −1" }, { value: "0", label: "15–44 tuổi · 0" }, { value: "1", label: "3–14 tuổi · +1" }] }]),
  sirs: ["Nhiệt độ bất thường", "Nhịp tim >90/phút", "Nhịp thở/PaCO₂ bất thường", "Bạch cầu/band bất thường"].map((label, index) => ({ key: ["temperature", "heartRate", "respiratoryRate", "whiteBloodCell"][index], label, options: binary })),
  "anion-gap": [{ key: "sodium", label: "Na⁺ (mmol/L)" }, { key: "chloride", label: "Cl⁻ (mmol/L)" }, { key: "bicarbonate", label: "HCO₃⁻ (mmol/L)" }, { key: "albumin", label: "Albumin (g/dL)", placeholder: "Không bắt buộc" }],
  "curb-65": ["Lú lẫn mới xuất hiện", "Ure >7 mmol/L", "Nhịp thở ≥30/phút", "HA tâm thu <90 hoặc tâm trương ≤60", "Tuổi ≥65"].map((label, index) => ({ key: ["confusion", "urea", "respiratoryRate", "bloodPressure", "age65"][index], label, options: binary })),
};

export interface ReferenceToolResult {
  rawValue: number | null;
  label: string;
  unit: string;
  interpretation: string;
  details?: Array<{ key: string; label: string; value: string | number }>;
}

function numeric(values: ReferenceInputValues, key: string): number | null {
  const value = values[key];
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function missingResult(label = "Kết quả", unit = ""): ReferenceToolResult { return { rawValue: null, label, unit, interpretation: "Nhập đủ dữ liệu để tính." }; }

export function calculateReferenceTool(type: ReferenceToolCalculatorType, values: ReferenceInputValues): ReferenceToolResult {
  const fields = referenceCalculatorFields[type] || [];
  const allFilled = fields.every((field) => numeric(values, field.key) !== null);
  const sumScore = () => fields.reduce((total, field) => total + (numeric(values, field.key) || 0), 0);
  if (type === "bsa" && allFilled) {
    const value = Math.sqrt((numeric(values, "heightCm")! * numeric(values, "weightKg")!) / 3600);
    return { rawValue: value, label: "BSA · Body Surface Area", unit: "m²", interpretation: "Mosteller; dùng chiều cao cm và cân nặng kg." };
  }
  if (["wells-pe", "cha2ds2-vasc", "child-pugh", "timi", "has-bled", "centor", "sirs", "curb-65"].includes(type) && allFilled) {
    const value = sumScore();
    if (type === "child-pugh") return { rawValue: value, label: "Child-Pugh Score", unit: "điểm", interpretation: value <= 6 ? "Child-Pugh A · 5–6 điểm" : value <= 9 ? "Child-Pugh B · 7–9 điểm" : "Child-Pugh C · 10–15 điểm", details: fields.map((field) => ({ key: field.key, label: field.label, value: numeric(values, field.key) || 0 })) };
    if (type === "sirs") return { rawValue: value, label: "SIRS Criteria", unit: "tiêu chí", interpretation: value >= 2 ? "Đạt ≥2 tiêu chí SIRS" : "Chưa đạt 2 tiêu chí SIRS" };
    return { rawValue: value, label: type === "wells-pe" ? "Wells' Score" : type, unit: "điểm", interpretation: "Cần đối chiếu ngưỡng diễn giải theo hướng dẫn tương ứng." };
  }
  if (type === "anion-gap") {
    const sodium = numeric(values, "sodium"); const chloride = numeric(values, "chloride"); const bicarbonate = numeric(values, "bicarbonate");
    if (sodium === null || chloride === null || bicarbonate === null) return missingResult("Anion Gap", "mmol/L");
    const value = sodium - chloride - bicarbonate; const albumin = numeric(values, "albumin");
    return { rawValue: value, label: "Anion Gap", unit: "mmol/L", interpretation: albumin === null ? "AG không gồm kali; có thể nhập albumin để hiệu chỉnh." : `AG hiệu chỉnh albumin: ${(value + 2.5 * (4 - albumin)).toFixed(1)} mmol/L` };
  }
  return missingResult();
}

export interface RenalReferenceInput {
  age: number | null;
  sex: "male" | "female";
  weightKg: number | null;
  heightM: number | null;
  creatinineMgDl: number | null;
  cystatinCMgL: number | null;
  egfrMethod: ReferenceEgfrMethod;
  crclVariant: ReferenceCrclVariant;
}

export interface RenalReferenceResult {
  bmi: number | null;
  egfr: number | null;
  egfrMethod: ReferenceEgfrMethod;
  crcl: number | null;
  crclLabel: string;
  crclUnit: string;
  selectedWeightKg: number | null;
  idealWeightKg: number | null;
  adjustedWeightKg: number | null;
  bsa: number | null;
  hollidayHourly: number | null;
  hollidayDaily: number | null;
}

export function calculateRenalReference(input: RenalReferenceInput): RenalReferenceResult {
  const { age, sex, weightKg, heightM, creatinineMgDl, cystatinCMgL, egfrMethod, crclVariant } = input;
  const validAge = age !== null && age > 0 && Number.isFinite(age);
  const validCreatinine = creatinineMgDl !== null && creatinineMgDl > 0 && Number.isFinite(creatinineMgDl);
  const validCystatin = cystatinCMgL !== null && cystatinCMgL > 0 && Number.isFinite(cystatinCMgL);
  const kappa = sex === "female" ? 0.7 : 0.9;
  const alpha = sex === "female" ? -0.241 : -0.302;
  const creatinineEgfr = validAge && validCreatinine ? 142 * Math.pow(Math.min(creatinineMgDl! / kappa, 1), alpha) * Math.pow(Math.max(creatinineMgDl! / kappa, 1), -1.2) * Math.pow(0.9938, age!) * (sex === "female" ? 1.012 : 1) : null;
  const cystatinEgfr = validAge && validCystatin ? 133 * Math.pow(Math.min(cystatinCMgL! / 0.8, 1), -0.499) * Math.pow(Math.max(cystatinCMgL! / 0.8, 1), -1.328) * Math.pow(0.996, age!) * (sex === "female" ? 0.932 : 1) : null;
  const combinedEgfr = validAge && validCreatinine && validCystatin ? 135 * Math.pow(Math.min(creatinineMgDl! / kappa, 1), alpha) * Math.pow(Math.max(creatinineMgDl! / kappa, 1), -0.601) * Math.pow(Math.min(cystatinCMgL! / 0.8, 1), -0.375) * Math.pow(Math.max(cystatinCMgL! / 0.8, 1), -0.711) * Math.pow(0.995, age!) * (sex === "female" ? 0.969 : 1) : null;
  const mdrd = validAge && validCreatinine ? 175 * Math.pow(creatinineMgDl!, -1.154) * Math.pow(age!, -0.203) * (sex === "female" ? 0.742 : 1) : null;
  const bmi = weightKg !== null && weightKg > 0 && heightM !== null && heightM > 0 ? weightKg / (heightM * heightM) : null;
  const heightInches = heightM !== null && heightM > 0 ? heightM / 0.0254 : null;
  const idealWeightKg = heightInches === null ? null : (sex === "female" ? 45.5 : 50) + 2.3 * (heightInches - 60);
  const adjustedWeightKg = idealWeightKg !== null && idealWeightKg > 0 && weightKg !== null && weightKg > 0 ? (weightKg < idealWeightKg ? weightKg : weightKg <= idealWeightKg * 1.2 ? idealWeightKg : idealWeightKg + 0.4 * (weightKg - idealWeightKg)) : null;
  const selectedWeightKg = crclVariant === "ideal-body-weight" ? idealWeightKg : crclVariant === "adjusted-body-weight" ? adjustedWeightKg : weightKg;
  const crclRaw = validAge && age! < 140 && selectedWeightKg !== null && selectedWeightKg > 0 && validCreatinine ? ((140 - age!) * selectedWeightKg) / (72 * creatinineMgDl!) * (sex === "female" ? 0.85 : 1) : null;
  const bsa = heightM !== null && heightM > 0 && weightKg !== null && weightKg > 0 ? Math.sqrt((heightM * 100 * weightKg) / 3600) : null;
  const crcl = crclRaw !== null && crclVariant === "bsa-normalized" && bsa !== null && bsa > 0 ? crclRaw * 1.73 / bsa : crclRaw;
  return {
    bmi,
    egfr: egfrMethod === "creatinine" ? creatinineEgfr : egfrMethod === "cystatin" ? cystatinEgfr : egfrMethod === "combined" ? combinedEgfr : mdrd,
    egfrMethod, crcl,
    crclLabel: crclVariant === "adjusted-body-weight" ? "CrCl · Cockcroft-Gault + AdjBW" : crclVariant === "ideal-body-weight" ? "CrCl · Cockcroft-Gault + IBW" : crclVariant === "bsa-normalized" ? "CrCl · chuẩn hóa BSA" : "CrCl · Cockcroft-Gault",
    crclUnit: crclVariant === "bsa-normalized" ? "mL/min/1,73 m²" : "mL/min",
    selectedWeightKg, idealWeightKg, adjustedWeightKg, bsa,
    hollidayHourly: weightKg !== null && weightKg > 0 ? weightKg <= 10 ? weightKg * 4 : weightKg <= 20 ? 40 + (weightKg - 10) * 2 : 60 + (weightKg - 20) : null,
    hollidayDaily: weightKg !== null && weightKg > 0 ? weightKg <= 10 ? weightKg * 100 : weightKg <= 20 ? 1000 + (weightKg - 10) * 50 : 1500 + (weightKg - 20) * 20 : null,
  };
}

export function toStructuredReferenceResult(topicKey: string, methodKey: string, formulaName: string, sourceReference: string, metric: string, value: number | null, unit: string, indexingStatus: IndexingStatus = "not_applicable"): CalculatorResult {
  return { calculatorTopicKey: topicKey, methodKey, implementationVersion: "1.0.0", calculationModelType: "equation", formulaName, sourceReference, primary: { metric, rawValue: value, roundedValue: value === null ? null : Number(value.toFixed(2)), displayValue: value === null ? "—" : value.toFixed(2), unit, indexingStatus }, warnings: [], applicabilityWarnings: [], calculationDetails: [] };
}
