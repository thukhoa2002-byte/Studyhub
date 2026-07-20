import { useState, type DragEvent, type MouseEvent, type ReactNode } from "react";

interface FileDropZoneProps {
  id: string;
  accept?: string;
  multiple?: boolean;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
  onClick?: (event: MouseEvent<HTMLLabelElement>) => void;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}

export default function FileDropZone({ id, accept, multiple = false, name, required = false, disabled = false, className = "", ariaLabel, title, onClick, onFiles, children }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!disabled) {
      event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <label
      htmlFor={id}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`${className} ${dragging ? "file-drop-zone--active" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {children}
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
          if (!name) event.target.value = "";
        }}
      />
    </label>
  );
}
