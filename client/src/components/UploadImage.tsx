import React from "react";

interface UploadImageProps {
  preview: string;
  loading: boolean;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
}

export default function UploadImage({
  preview,
  loading,
  onImageChange,
  onGenerate,
}: UploadImageProps) {
  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-2xl bg-white p-8 shadow-lg">

      <h2 className="mb-2 text-3xl font-bold">
        Tạo bộ câu hỏi
      </h2>

      <p className="mb-8 text-gray-500">
        Chọn một ảnh chứa nội dung bài học để AI tạo bộ câu hỏi ôn tập.
      </p>

      <label className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 transition hover:border-blue-500 hover:bg-blue-50">

        <span className="text-lg font-semibold">
          Chọn ảnh
        </span>

        <span className="mt-2 text-sm text-gray-500">
          PNG, JPG, JPEG
        </span>

        <input
          type="file"
          accept="image/*"
          onChange={onImageChange}
          className="hidden"
        />
      </label>

      {preview && (
        <div className="mt-8">
          <img
            src={preview}
            alt="Preview"
            className="max-h-[500px] w-full rounded-xl border object-contain"
          />
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={!preview || loading}
        className="mt-8 w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {loading ? "Đang tạo câu hỏi..." : "Bắt đầu học"}
      </button>

    </div>
  );
}