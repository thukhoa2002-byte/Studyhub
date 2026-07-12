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
    <>
      <input
        className="mt-8 w-full"
        type="file"
        accept="image/*"
        onChange={onImageChange}
      />

      {preview && (
        <img
          src={preview}
          alt="Preview"
          className="mt-6 rounded-xl border"
        />
      )}

      <button
        onClick={onGenerate}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-blue-600 py-4 text-xl font-bold text-white"
      >
        {loading ? "Đang tạo..." : "Tạo câu hỏi"}
      </button>
    </>
  );
}