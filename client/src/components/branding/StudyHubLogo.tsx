import BrandLogo from "./BrandLogo";

interface Props { size?: "sm" | "md" | "lg"; decorative?: boolean; className?: string }

export default function StudyHubLogo({ size = "md", decorative = false, className = "" }: Props) {
  return <BrandLogo variant="full" size={size} decorative={decorative} className={className} />;
}
