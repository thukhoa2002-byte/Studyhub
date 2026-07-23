export function buildDrugExtractionPrompt({ text, drugName, sourceMetadata, chunkIndex = 0, chunkCount = 1 }) {
  const chunkNote = chunkCount > 1
    ? `Đây là phần ${chunkIndex + 1}/${chunkCount} của cùng một tài liệu. Chỉ trích xuất thông tin có trong phần này; không coi việc thiếu trường là bằng chứng trường đó không tồn tại ở phần khác.`
    : "Đây là toàn bộ phần văn bản được cung cấp.";
  return `Bạn là hệ thống trích xuất dữ liệu thuốc. Chỉ sử dụng văn bản nguồn được cung cấp, không bổ sung kiến thức ngoài nguồn, không suy đoán và không tự tạo liều/chỉ định/chống chỉ định/tương tác. Trường không có trong nguồn phải để chuỗi rỗng hoặc mảng rỗng. Giữ nguyên số, đơn vị, đường dùng và điều kiện áp dụng. Phân biệt người lớn, trẻ em, người cao tuổi, liều nạp, liều duy trì, chỉ định, suy thận và suy gan nếu nguồn có nêu. Không đánh dấu sourceVerified và không publish. Thuốc cần trích xuất: ${String(drugName || "chưa chỉ rõ")}. Metadata nguồn: ${JSON.stringify(sourceMetadata)}. ${chunkNote} Trả về đúng schema JSON, không trả về markdown.\n\nVĂN BẢN NGUỒN:\n${text}`;
}

export function buildGuidelineTableExtractionPrompt({ text, sourceMetadata, chunkIndex = 0, chunkCount = 1 }) {
  const chunkNote = chunkCount > 1 ? `Đây là phần ${chunkIndex + 1}/${chunkCount} của cùng tài liệu.` : "Đây là toàn bộ phần văn bản được cung cấp.";
  const instructions = [
    "Bạn là hệ thống trích xuất guideline và bảng thuốc.",
    "Chỉ dùng nội dung nguồn, không bổ sung kiến thức, không suy đoán liều.",
    chunkNote,
    "Nhận diện phần hướng dẫn chung của guideline riêng với các dòng dữ liệu thuốc riêng.",
    "Mỗi hoạt chất trong bảng là một row riêng; không gộp nhiều hoạt chất vào một hồ sơ và không sao chép phần hướng dẫn chung vào row thuốc.",
    "Nếu tài liệu có bảng, giữ tên bảng, số bảng, trang, section và nội dung từng hàng.",
    "Với mỗi thuốc, chỉ điền liều, đơn vị, tần suất, chỉnh liều, chống chỉ định hoặc theo dõi nếu chính hàng/bảng nêu rõ.",
    "Nếu là ảnh hoặc bảng OCR không chắc chắn, giữ nguyên nội dung nhận diện được và thêm cảnh báo để người dùng kiểm tra.",
    "Không tự tạo drugId; để chuỗi rỗng nếu chưa có ID trong nguồn.",
    `Metadata nguồn: ${JSON.stringify(sourceMetadata)}.`,
    "Trả về đúng schema JSON, không markdown.",
  ].join(" ");
  return `${instructions}\n\nVĂN BẢN NGUỒN:\n${text}`;
}
