import BrandLogo from "./BrandLogo";

interface Props { size?: "sm" | "md" | "lg"; decorative?: boolean; className?: string }

export default function StudyHubIcon({ size = "md", decorative = false, className = "" }: Props) {
  return <BrandLogo variant="icon" size={size} decorative={decorative} className={className} />;
}
