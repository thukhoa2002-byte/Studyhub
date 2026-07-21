import { Check, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { PointerEvent } from "react";
import { useRef, useState } from "react";

type CropState = { source: string; x: number; y: number; width: number; height: number };
type CropHandle = "nw" | "ne" | "sw" | "se";
type CropDrag = { mode: "create" | "move" | "resize"; handle?: CropHandle; pointerId: number; startX: number; startY: number; startCrop: CropState };

const handleClasses: Record<CropHandle, string> = {
  nw: "-left-2 -top-2 cursor-nwse-resize",
  ne: "-right-2 -top-2 cursor-nesw-resize",
  sw: "-bottom-2 -left-2 cursor-nesw-resize",
  se: "-bottom-2 -right-2 cursor-nwse-resize",
};

function normalizeCrop(crop: CropState): CropState {
  const width = Math.max(1, Math.min(100, crop.width));
  const height = Math.max(1, Math.min(100, crop.height));
  return { ...crop, x: Math.max(0, Math.min(100 - width, crop.x)), y: Math.max(0, Math.min(100 - height, crop.y)), width, height };
}

interface Props {
  source: string;
  onClose: () => void;
  onApply: (source: string) => void;
}

export default function ImageCropDialog({ source, onClose, onApply }: Props) {
  const [crop, setCrop] = useState<CropState>({ source, x: 0, y: 0, width: 100, height: 100 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<CropDrag | null>(null);

  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const nextPoint = point(event);
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-crop-handle]")?.dataset.cropHandle as CropHandle | undefined;
    const full = crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
    const inside = nextPoint.x >= crop.x && nextPoint.x <= crop.x + crop.width && nextPoint.y >= crop.y && nextPoint.y <= crop.y + crop.height;
    dragRef.current = { mode: handle ? "resize" : (!full && inside ? "move" : "create"), handle, pointerId: event.pointerId, startX: nextPoint.x, startY: nextPoint.y, startCrop: crop };
    stageRef.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextPoint = point(event);
    const dx = nextPoint.x - drag.startX;
    const dy = nextPoint.y - drag.startY;
    const base = drag.startCrop;
    let next = base;
    if (drag.mode === "create") {
      next = { ...base, x: Math.min(drag.startX, nextPoint.x), y: Math.min(drag.startY, nextPoint.y), width: Math.abs(dx), height: Math.abs(dy) };
    } else if (drag.mode === "move") {
      next = { ...base, x: base.x + dx, y: base.y + dy };
    } else if (drag.handle) {
      let left = base.x;
      let top = base.y;
      let right = base.x + base.width;
      let bottom = base.y + base.height;
      if (drag.handle.includes("w")) left = Math.min(Math.max(0, nextPoint.x), right - 1);
      if (drag.handle.includes("e")) right = Math.max(Math.min(100, nextPoint.x), left + 1);
      if (drag.handle.includes("n")) top = Math.min(Math.max(0, nextPoint.y), bottom - 1);
      if (drag.handle.includes("s")) bottom = Math.max(Math.min(100, nextPoint.y), top + 1);
      next = { ...base, x: left, y: top, width: right - left, height: bottom - top };
    }
    setCrop(normalizeCrop(next));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    stageRef.current?.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function applyCrop() {
    const image = new Image();
    image.onload = () => {
      const sourceX = image.naturalWidth * crop.x / 100;
      const sourceY = image.naturalHeight * crop.y / 100;
      const sourceWidth = image.naturalWidth * crop.width / 100;
      const sourceHeight = image.naturalHeight * crop.height / 100;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth));
      canvas.height = Math.max(1, Math.round(sourceHeight));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      onApply(canvas.toDataURL("image/png"));
    };
    image.src = source;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Cắt ảnh trong lời giải">
      <div className="flex min-h-full items-center justify-center">
        <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-violet-600">Cắt ảnh</p><h2 className="mt-1 text-lg font-black text-slate-900">Chọn phần ảnh cần giữ lại</h2></div><button type="button" title="Đóng" aria-label="Đóng trình cắt ảnh" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X size={19} /></button></div>
          <div className="mt-5 flex justify-center"><div ref={stageRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} className="relative inline-block max-w-full touch-none select-none overflow-hidden rounded-2xl bg-slate-100 shadow-inner"><img src={source} alt="Ảnh đang cắt" draggable={false} className="block max-h-[68vh] max-w-[min(90vw,900px)] object-contain" /><div className="absolute border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,.5)]" style={{ left: crop.x + "%", top: crop.y + "%", width: crop.width + "%", height: crop.height + "%" }}>{(["nw", "ne", "sw", "se"] as CropHandle[]).map((handle) => <span key={handle} data-crop-handle={handle} className={"pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-white bg-violet-600 shadow " + handleClasses[handle]} />)}</div></div></div>
          <p className="mt-3 text-center text-xs font-semibold text-slate-500">Kéo trên ảnh để tạo hoặc di chuyển vùng cắt. Kéo các góc để chỉnh kích thước.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Hủy</button><button type="button" onClick={applyCrop} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"><Check size={17} />Áp dụng</button></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
