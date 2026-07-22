import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

/** A compact single-kidney mark matching the custom lungs icon style. */
export default function KidneyIcon({ size = 24, strokeWidth = 1.8, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12.1 4.65V2.8" />
      <path d="M12.1 2.8c-.6.8-1.4 1.1-2.15 1.1M12.1 2.8c.6.8 1.4 1.1 2.15 1.1" />
      <path d="M12.1 4.65C9.35 3 5.75 4.05 4.65 7.15c-.78 1.97-.55 4.75-.3 6.65.35 2.8 1.8 4.75 4.15 5.25 1.85.4 3.3-.7 3.35-2.35.04-1.25-.68-2.08-.5-3.55.2-1.6 1.4-2.4 1.9-3.75.55-1.55.35-3.7-1.15-4.75Z" />
      <path d="M12.2 12.8c-.1 1.55.3 3.25 1.2 4.65" />
    </svg>
  );
}
