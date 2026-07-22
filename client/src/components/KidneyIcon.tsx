import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

/** A compact paired-kidney mark matching the custom lungs icon style. */
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
      <path d="M9.45 4.2C7.3 2.95 4.6 3.8 3.65 6.15c-.72 1.78-.52 4.1-.32 5.9.3 2.73 1.55 5.07 3.85 5.73 1.55.45 2.82-.42 3.06-1.82.2-1.18-.35-2.18-.28-3.48.08-1.6 1.13-2.52 1.13-4.05 0-1.78-.5-3.4-1.64-4.23Z" />
      <path d="M14.55 4.2c2.15-1.25 4.85-.4 5.8 1.95.72 1.78.52 4.1.32 5.9-.3 2.73-1.55 5.07-3.85 5.73-1.55.45-2.82-.42-3.06-1.82-.2-1.18.35-2.18.28-3.48-.08-1.6-1.13-2.52-1.13-4.05 0-1.78.5-3.4 1.64-4.23Z" />
      <path d="M10.95 9.15c.18 1.2.54 2.05 1.05 2.75.51-.7.87-1.55 1.05-2.75" />
      <path d="M10.25 16.1c.18 1.42.72 2.55 1.75 3.65 1.03-1.1 1.57-2.23 1.75-3.65" />
      <path d="M12 11.9v4.2" />
    </svg>
  );
}
