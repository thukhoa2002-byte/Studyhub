export function normalizeOutputLanguage(value) {
  return value === "en" || value === "bilingual" ? value : "vi";
}

function translationInstructions(outputLanguage) {
  if (outputLanguage === "en") return "Giữ nguyên tiếng Anh của nguồn cho các trường hiển thị. Không dịch lại khi người dùng chuyển chế độ. Đồng thời luôn điền localizedContent.vi bằng bản dịch tiếng Việt y khoa và localizedContent.en bằng nguyên văn tiếng Anh.";
  if (outputLanguage === "bilingual") return "Dịch toàn bộ nội dung mô tả sang tiếng Việt y khoa và giữ tiếng Anh gốc. Các trường localizedContent phải có cấu trúc {vi, en}; không trộn hai ngôn ngữ trong cùng một giá trị. Các trường hiển thị dùng tiếng Việt. Không dịch tên thuốc, tên guideline, viết tắt chuẩn hoặc đơn vị. Không thêm kiến thức, không rút gọn.";
  return "Dịch toàn bộ nội dung mô tả sang tiếng Việt y khoa. Các trường localizedContent phải có cấu trúc {vi, en}; không trộn hai ngôn ngữ trong cùng một giá trị. Các trường hiển thị dùng tiếng Việt. Không dịch tên thuốc, tên guideline, viết tắt chuẩn ACEI, ARB, ARNI, MRA, SGLT2, HFrEF, HFmrEF, HFpEF, NYHA, CKD, eGFR, K+ hoặc đơn vị mg, mmol/L và các đơn vị khác. Không thêm kiến thức, không diễn giải thêm, không rút gọn.";
}

function missingValueInstruction() {
  return "Nếu nguồn không đề cập một trường, trả về chuỗi rỗng hoặc mảng rỗng. Tuyệt đối không viết các câu như Not specified in the provided text, Not mentioned, Not available, N/A hoặc biến thể tương tự.";
}

export function buildDrugExtractionPrompt({ text, drugName, sourceMetadata, outputLanguage = "vi", chunkIndex = 0, chunkCount = 1 }) {
  const language = normalizeOutputLanguage(outputLanguage);
  const chunkNote = chunkCount > 1
    ? `Đây là phần ${chunkIndex + 1}/${chunkCount} của cùng một tài liệu. Chỉ trích xuất thông tin có trong phần này; không coi việc thiếu trường là bằng chứng trường đó không tồn tại ở phần khác.`
    : "Đây là toàn bộ phần văn bản được cung cấp.";
  return `Bạn là hệ thống trích xuất dữ liệu thuốc. Chỉ sử dụng văn bản nguồn được cung cấp, không bổ sung kiến thức ngoài nguồn, không suy đoán và không tự tạo liều/chỉ định/chống chỉ định/tương tác. ${missingValueInstruction()} Không cần tự tạo id hoặc slug; hệ thống sẽ sinh hai trường này khi lưu. Giữ nguyên số, đơn vị, đường dùng và điều kiện áp dụng. Phân biệt người lớn, trẻ em, người cao tuổi, liều nạp, liều duy trì, chỉ định, suy thận và suy gan nếu nguồn có nêu. ${translationInstructions(language)} Không đánh dấu sourceVerified và không publish. Thuốc cần trích xuất: ${String(drugName || "chưa chỉ rõ")}. Metadata nguồn: ${JSON.stringify(sourceMetadata)}. ${chunkNote} Trả về đúng schema JSON, không trả về markdown.\n\nVĂN BẢN NGUỒN:\n${text}`;
}

export function buildGuidelineTableExtractionPrompt({ text, sourceMetadata, itemType = "table", outputLanguage = "vi", chunkIndex = 0, chunkCount = 1 }) {
  const language = normalizeOutputLanguage(outputLanguage);
  const chunkNote = chunkCount > 1 ? `Đây là phần ${chunkIndex + 1}/${chunkCount} của cùng tài liệu.` : "Đây là toàn bộ phần văn bản được cung cấp.";
  const instructions = [
    "Bạn là hệ thống trích xuất guideline và bảng thuốc.",
    "Chỉ dùng nội dung nguồn, không bổ sung kiến thức, không suy đoán liều.",
    missingValueInstruction(),
    translationInstructions(language),
    chunkNote,
    `Đây là mục tài liệu loại ${itemType}. Chỉ xử lý nội dung trong mục này, không suy ra dữ liệu từ bảng hoặc mục khác.`,
    "Nhận diện phần hướng dẫn chung của guideline riêng với các dòng dữ liệu thuốc riêng.",
    "Tách phần hướng dẫn chung vào commonGuidance gồm: why, indications, contraindications, cautions, monitoring, initiation, titration, problemSolving. Đây là nội dung của cả nhóm thuốc, không chép lại vào từng row.",
    "Nếu nguồn dùng nhãn WHY, WHEN hoặc HOW TO USE thì lần lượt đưa vào why, indications và nhóm initiation/titration/problemSolving; dịch các nhãn này sang tiếng Việt y khoa theo ngôn ngữ đầu ra.",
    "Ngoài các trường hiển thị, luôn điền localizedContent: mỗi trường mô tả dùng {vi, en}, trong đó en là nguyên văn nguồn và vi là bản dịch đầy đủ. Không trộn hai ngôn ngữ trong cùng một giá trị; tên thuốc, số liệu, đơn vị và viết tắt giữ nguyên.",
    "Mỗi hoạt chất trong bảng là một row riêng; không gộp nhiều hoạt chất vào một hồ sơ và không sao chép phần hướng dẫn chung vào row thuốc.",
    "Nếu tài liệu có bảng, giữ tên bảng, số bảng, trang, section và nội dung từng hàng.",
    "Với mỗi thuốc, chỉ điền indications, startingDose, targetDose, frequency, route, notes, liều/đơn vị, chỉnh liều, chống chỉ định hoặc theo dõi nếu chính hàng/bảng nêu rõ. Không đưa chống chỉ định/thận trọng chung vào row nếu không gắn riêng với hoạt chất.",
    "Nếu là figure, algorithm, flowchart hoặc appendix không có dòng thuốc, trả về rows rỗng và đưa nội dung vào commonGuidance; không bịa thuốc.",
    "Nếu là ảnh hoặc bảng OCR không chắc chắn, giữ nguyên nội dung nhận diện được và thêm cảnh báo để người dùng kiểm tra.",
    "Không tự tạo drugId; để chuỗi rỗng nếu chưa có ID trong nguồn.",
    `Metadata nguồn: ${JSON.stringify(sourceMetadata)}.`,
    "Trả về đúng schema JSON, không markdown.",
  ].join(" ");
  return `${instructions}\n\nVĂN BẢN NGUỒN:\n${text}`;
}
