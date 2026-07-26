import { brandAssets } from "./brandAssets";

type BrandLogoProps = {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg";
  decorative?: boolean;
  className?: string;
  priority?: boolean;
};

const sizeClasses = {
  full: { sm: "w-32", md: "w-40", lg: "w-52" },
  icon: { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-16 w-16" },
} as const;

export default function BrandLogo({ variant = "full", size = "md", decorative = false, className = "", priority = false }: BrandLogoProps) {
  const isFullLogo = variant === "full";
  const alt = decorative ? "" : isFullLogo ? "StudyHub — Learn. Connect. Apply." : "StudyHub";

  return <img
    src={isFullLogo ? brandAssets.logo : brandAssets.icon}
    alt={alt}
    aria-hidden={decorative || undefined}
    loading={priority ? "eager" : "lazy"}
    decoding="async"
    className={`${sizeClasses[variant][size]} h-auto object-contain ${className}`}
  />;
}
