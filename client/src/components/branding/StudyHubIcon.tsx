interface Props { size?: "sm" | "md" | "lg"; decorative?: boolean; className?: string }

const sizes = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-16 w-16" } as const;

export default function StudyHubIcon({ size = "md", decorative = false, className = "" }: Props) {
  return <img src="/brand/studyhub-icon.svg" alt={decorative ? "" : "StudyHub"} aria-hidden={decorative || undefined} className={`${sizes[size]} object-contain ${className}`} />;
}
