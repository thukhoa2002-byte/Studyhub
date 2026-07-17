import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import os from "node:os";
import { requireMcqAdmin } from "../middleware/mcqAdmin.js";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const upload = multer({
  // Large PDFs must not occupy the Render process heap while Gemini is reading them.
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, os.tmpdir()),
    filename: (_req, _file, callback) => callback(null, `mcq-${randomUUID()}.upload`),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 20 },
});

const optionSchema = {
  type: "object",
  properties: {
    id: { type: "string", enum: ["A", "B", "C", "D"] },
    text: { type: "string" },
  },
  required: ["id", "text"],
  additionalProperties: false,
};

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_number: { type: "integer" },
          question: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: optionSchema },
          correct_answer: { type: "string", enum: ["A", "B", "C", "D", ""] },
          explanation: { type: "string" },
          image_source_name: { type: "string" },
          image_alt: { type: "string" },
          review_note: { type: "string" },
        },
        required: ["source_number", "question", "options", "correct_answer", "explanation", "image_source_name", "image_alt", "review_note"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

const prompt = `Bạn là biên tập viên ngân hàng câu hỏi y khoa. Hãy đọc TOÀN BỘ các file được cung cấp và chuyển toàn bộ đề trắc nghiệm thành dữ liệu học tập có thể đưa vào Front/Back.

ĐẶC ĐIỂM TÀI LIỆU CẦN XỬ LÝ
- PDF có thể được xuất từ Notion/ứng dụng ghi chú: một số trang có lớp chữ, một số nội dung hoặc đề thi nằm trong ảnh chụp, ảnh scan hay ảnh X-quang.
- Bắt buộc quan sát trực tiếp phần hình ảnh của TỪNG TRANG, không chỉ dựa vào lớp text OCR của PDF.
- Ghi chú học tập, phần giảng bài, bảng tóm tắt, tiêu đề, mục “TRẢ LỜI”, đáp án tô màu/gạch chân và lời giải có thể nằm xen giữa các câu.

MỤC TIÊU DUY NHẤT
- Giữ nguyên và đầy đủ mọi câu hỏi trắc nghiệm có trong tài liệu, theo đúng thứ tự xuất hiện.
- Tách riêng từng thành phần vào đúng trường: đề vào question, lựa chọn vào options, đáp án vào correct_answer, lời giải/ghi chú liên quan vào explanation.
- Không bỏ qua các trang hoặc các đoạn có nhãn “ĐÁP ÁN”, “TRẢ LỜI”, “GIẢI THÍCH”, “GHI CHÚ”, “NHẬN XÉT”, “ĐÁP ÁN THAM KHẢO”, bảng đáp án hoặc chú thích dưới câu.
- Không tự tạo câu hỏi mới. Không sửa nội dung chuyên môn, ngoại trừ chuẩn hóa khoảng trắng và nối các dòng bị ngắt do bố cục PDF.

QUY TẮC TRÍCH XUẤT
1. Đọc theo hai lượt trong cùng một lần xử lý: lượt đầu xác định ranh giới từng câu trên tất cả trang, kể cả chữ nằm trong ảnh; lượt sau đối chiếu lại đề, lựa chọn, bảng đáp án và lời giải.
2. Một MCQ hợp lệ cần đề hoàn chỉnh và đủ bốn lựa chọn được ký hiệu A, B, C, D. Ghi chú có bốn gạch đầu dòng nhưng không có cấu trúc câu hỏi thì không được biến thành MCQ.
3. Đánh số lại source_number từ 1, 2, 3... theo thứ tự các câu được trích xuất trong tài liệu. Không giữ số trang làm số câu và không sắp xếp lại theo chủ đề.
4. Mỗi câu phải có đúng bốn lựa chọn với id lần lượt A, B, C, D. Không gộp lựa chọn, không làm mất ý do xuống dòng.
5. Tìm đáp án ở cả ngay sau câu, cuối trang, cuối chương, bảng đáp án và phần “TRẢ LỜI”. Nếu nguồn ghi bằng chữ thay vì A/B/C/D, đối chiếu với options rồi đổi thành đúng một id A, B, C hoặc D. Nếu không tìm thấy đáp án chắc chắn, để correct_answer là chuỗi rỗng, tuyệt đối không đoán.
6. explanation phải chứa đầy đủ lời giải, lý do chọn đáp án, ghi chú học tập và thông tin phân biệt liên quan đến câu đó. Giữ số liệu, đơn vị, tiêu chuẩn, ngoại lệ và thứ tự ý; không rút gọn thành một câu nếu làm mất nội dung. Nếu nguồn không có lời giải, để chuỗi rỗng.
7. Chuẩn hóa khoảng trắng, bỏ đầu trang/chân trang/số trang lặp lại và khoảng trống thừa. Không để dòng trống bất thường.
8. Không chép hình trang trí, logo, biểu đồ không cần thiết hoặc ảnh chứa đáp án.
9. Nếu hình chỉ minh họa và có thể diễn đạt CHÍNH XÁC, KHÔNG SUY DIỄN bằng chữ, chuyển thông tin nhìn thấy cần thiết thành một mô tả trung tính ngắn đặt trong question. Nếu hình là dữ kiện quyết định và không thể diễn đạt chắc chắn, giữ câu và ghi cảnh báo trong review_note để người duyệt kiểm tra, không tự loại câu.
10. Riêng hình X-quang: nếu hình được gửi dưới dạng file ảnh riêng và thuộc câu hỏi, giữ image_source_name đúng CHÍNH XÁC tên file ảnh đó để hệ thống đặt ảnh dưới đề. Với X-quang nằm bên trong PDF, không bịa mô tả chẩn đoán; ghi review_note rằng câu có ảnh X-quang nhúng trong PDF để người duyệt kiểm tra. Nếu không chắc ảnh thuộc câu nào, để image_source_name rỗng.
11. image_alt chỉ mô tả trung tính loại hình, không diễn giải chẩn đoán hay làm lộ đáp án.
12. review_note chỉ ghi cảnh báo cần người duyệt kiểm tra như OCR khó đọc, ảnh nhúng trong PDF hoặc nghi mất chữ. Nếu không có vấn đề, trả chuỗi rỗng.
13. Không biến nội dung trong khối “TRẢ LỜI”, nhận xét bên lề, ghi chú học tập hoặc đoạn giải thích thành câu hỏi mới; phải gắn chúng vào câu ngay trước đó khi có thể xác định được.
14. Không bỏ cả bộ chỉ vì một câu khó đọc. Giữ lại mọi câu đủ đề và bốn lựa chọn, kể cả khi câu đó chưa có correct_answer; ghi cảnh báo ngắn trong review_note.

TỰ KIỂM TRA TRƯỚC KHI TRẢ
- Từng câu có đúng A/B/C/D, không trùng id, không rỗng.
- correct_answer là A/B/C/D hoặc chuỗi rỗng, và không bị đặt nhầm vào question/options.
- explanation đã chứa phần giải thích/ghi chú tương ứng, không làm mất số liệu hoặc ngoại lệ.
- Không có ký tự xuống dòng vô lý trong câu hoặc lựa chọn.
- source_number liên tục từ 1 đến hết danh sách.
- Không tạo thêm câu không tồn tại trong nguồn và không loại các câu hợp lệ chỉ vì chưa tìm thấy đáp án.

Trả đúng JSON theo schema, không thêm văn bản bên ngoài JSON.`;

function normalizeQuestions(rawQuestions) {
  let nextSourceNumber = 0;
  return (Array.isArray(rawQuestions) ? rawQuestions : []).flatMap((rawQuestion) => {
    const question = String(rawQuestion?.question || "").replace(/\s+/g, " ").trim();
    const rawOptions = Array.isArray(rawQuestion?.options) ? rawQuestion.options : [];
    const options = ["A", "B", "C", "D"].map((id) => ({
      id,
      text: String(rawOptions.find((option) => option?.id === id)?.text || "").replace(/\s+/g, " ").trim(),
    }));
    if (!question || options.some((option) => !option.text)) return [];
    const answerValue = String(rawQuestion?.correct_answer || "").trim().toUpperCase();
    const answerByText = options.find((option) => option.text.toLocaleLowerCase("vi") === answerValue.toLocaleLowerCase("vi"));
    const correctAnswer = ["A", "B", "C", "D"].includes(answerValue) ? answerValue : answerByText?.id || "";
    nextSourceNumber += 1;
    return [{
      source_number: nextSourceNumber,
      question,
      options,
      correct_answer: correctAnswer,
      explanation: String(rawQuestion?.explanation || "").replace(/\s+/g, " ").trim(),
      image_source_name: String(rawQuestion?.image_source_name || "").trim(),
      image_alt: String(rawQuestion?.image_alt || "").replace(/\s+/g, " ").trim(),
      review_note: String(rawQuestion?.review_note || (correctAnswer ? "" : "Chưa tìm thấy đáp án chắc chắn trong tài liệu.")).replace(/\s+/g, " ").trim(),
    }];
  });
}

function uploadFiles(req, res, next) {
  upload.array("files", 20)(req, res, (error) => {
    if (!error) return next();
    void cleanupUploadedFiles(req.files);
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "Mỗi file không được vượt quá 100 MB." });
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({ success: false, message: "Mỗi lần chỉ được tải tối đa 20 file." });
    }
    return res.status(400).json({ success: false, message: error?.message || "Không thể nhận file tải lên." });
  });
}

async function cleanupUploadedFiles(files) {
  await Promise.allSettled((files || []).filter((file) => file.path).map((file) => unlink(file.path)));
}

router.post("/extract", requireMcqAdmin, uploadFiles, async (req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) return res.status(400).json({ success: false, message: "Chưa chọn file câu hỏi." });
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return res.status(413).json({ success: false, message: "Tổng dung lượng file không được vượt quá 120 MB." });
    }
    const supportedImages = new Set(["image/png", "image/jpeg"]);
    const unsupported = files.find((file) => !supportedImages.has(file.mimetype) && file.mimetype !== "application/pdf");
    if (unsupported) {
      return res.status(415).json({ success: false, message: `File ${unsupported.originalname} chưa được hỗ trợ. Hãy dùng PDF hoặc ảnh.` });
    }
    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) {
      return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    }
    const result = await generateStructuredFromFile({
      files,
      schema,
      prompt,
      maxOutputTokens: 48000,
      timeoutMs: 300_000,
    });
    const questions = normalizeQuestions(result.questions);
    if (!questions.length) {
      return res.status(422).json({
        success: false,
        message: "Gemini chưa tìm thấy câu hỏi nào có đủ đề và bốn lựa chọn A/B/C/D. Hãy kiểm tra PDF hoặc tải riêng các trang chứa đề.",
      });
    }
    return res.json({
      success: true,
      data: {
        title: result.title || "Bộ MCQ mới",
        questions,
      },
      aiCallsRemaining,
    });
  } catch (error) {
    console.error("MCQ import failed", error);
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: error?.message || "Không thể trích xuất bộ MCQ." });
  } finally {
    await cleanupUploadedFiles(files);
  }
});

export default router;
