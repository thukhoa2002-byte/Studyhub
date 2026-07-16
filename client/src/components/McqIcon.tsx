import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

/** A compact multiple-choice answer sheet, designed for the MCQ workspace. */
export default function McqIcon({ size = 24, strokeWidth = 1.9, ...props }: Props) {
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
      <path d="M6.25 2.75h9.25l3.75 3.75v14.75H6.25A2.25 2.25 0 0 1 4 19V5a2.25 2.25 0 0 1 2.25-2.25Z" />
      <path d="M15.5 2.9v3.6h3.55" />
      <circle cx="8" cy="9.5" r="1.15" />
      <path d="M11 9.5h4.7" />
      <circle cx="8" cy="13.5" r="1.15" />
      <path d="M11 13.5h4.7" />
      <circle cx="8" cy="17.5" r="1.15" />
      <path d="m7.4 17.5.45.45.85-.95M11 17.5h4.7" />
    </svg>
  );
}
