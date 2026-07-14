import { FileText } from "lucide-react";

interface Props { title?: string; description?: string; imageSrc?: string; }

export default function LoadingOverlay({ title = "Đang xử lý...", description = "Một chút thôi, mình đang chuẩn bị nội dung cho bạn.", imageSrc }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/20 px-4 backdrop-blur-md">

      <div className="w-full max-w-md rounded-[32px] border border-rose-100 bg-gradient-to-br from-white via-rose-50/80 to-teal-50/80 p-8 text-center shadow-[0_24px_70px_rgba(190,24,93,0.2)] sm:p-10">

        <div className="scan-paper mx-auto" aria-label={imageSrc ? "Đang quét ảnh" : "Đang xử lý"}><FileText size={52} strokeWidth={1.5} /><span className="scan-line" /></div>

        <h2 className="mt-7 text-2xl font-bold text-rose-950">{title}</h2>

        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-500">{description}</p>

        <div className="mt-10 h-3 overflow-hidden rounded-full bg-slate-200">

          <div className="loading-progress h-full w-2/5 rounded-full bg-gradient-to-r from-rose-300 via-fuchsia-400 to-teal-400" />

        </div>

        <p className="mt-5 text-sm text-slate-400">
          Đang chuẩn bị, bạn chờ mình một chút nhé 🌸
        </p>

      </div>

    </div>
  );
}
