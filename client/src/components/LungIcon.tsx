import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

/** A compact lungs mark for medical MCQ folders. */
export default function LungIcon({ size = 24, strokeWidth = 1.8, ...props }: Props) {
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
      <path d="M12 3.25v8.2" />
      <path d="M12 7.2c-1.35 0-2.45-1.25-2.45-3.95" />
      <path d="M12 8.35c-1.5 0-2.15 1.7-3.75 2.25" />
      <path d="M12 11.45c-1.55.1-2.15-1.25-3.4-1.25-1.8 0-3.55 1.6-4.15 3.4-.55 1.65-.55 5.25.15 6.05.7.8 1.9.7 2.75.35 2.65-1.05 4.45-3.1 4.65-6.5" />
      <path d="M12 8.35c1.5 0 2.15 1.7 3.75 2.25" />
      <path d="M12 11.45c1.55.1 2.15-1.25 3.4-1.25 1.8 0 3.55 1.6 4.15 3.4.55 1.65.55 5.25-.15 6.05-.7.8-1.9.7-2.75.35-2.65-1.05-4.45-3.1-4.65-6.5" />
    </svg>
  );
}
