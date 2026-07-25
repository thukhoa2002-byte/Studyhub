interface Props { size?: "sm" | "md" | "lg"; decorative?: boolean; className?: string }

const widths = { sm: "w-32", md: "w-40", lg: "w-52" } as const;

export default function StudyHubLogo({ size = "md", decorative = false, className = "" }: Props) {
  return <img src="/brand/studyhub-logo.svg" alt={decorative ? "" : "StudyHub - Learn. Connect. Apply."} aria-hidden={decorative || undefined} className={`${widths[size]} h-auto object-contain ${className}`} />;
}
