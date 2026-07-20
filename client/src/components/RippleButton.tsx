import type { CSSProperties, ReactNode } from "react";

interface RippleButtonProps {
  text?: string;
  icon?: ReactNode;
  bgColor?: string;
  circleColor?: string;
  width?: string;
  height?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export default function RippleButton({ text = "Click Me", icon, bgColor, circleColor, width, height, className = "", disabled = false, onClick }: RippleButtonProps) {
  const style: CSSProperties = {
    ...(bgColor ? { backgroundColor: bgColor } : {}),
    ...(circleColor ? { "--ripple-circle": circleColor } as CSSProperties : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  return (
    <button type="button" disabled={disabled} onClick={onClick} style={style} className={`ripple-btn ${className}`}>
      <span className="ripple-btn__circle ripple-btn__circle--1" />
      <span className="ripple-btn__circle ripple-btn__circle--2" />
      <span className="ripple-btn__circle ripple-btn__circle--3" />
      <span className="ripple-btn__circle ripple-btn__circle--4" />
      <span className="ripple-btn__circle ripple-btn__circle--5" />
      <span className="ripple-btn__label">{text}{icon}</span>
    </button>
  );
}
