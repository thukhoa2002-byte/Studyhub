import type { ComponentType, ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleX, Inbox, Info, type LucideProps } from "lucide-react";

type Icon = ComponentType<LucideProps>;

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`ui-page ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, icon: IconComponent, actions, className = "" }: { eyebrow?: string; title: ReactNode; description?: ReactNode; icon?: Icon; actions?: ReactNode; className?: string }) {
  return <header className={`ui-page-header ${className}`}>
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        {IconComponent && <span className="ui-page-header__icon"><IconComponent size={21} strokeWidth={2.1} /></span>}
        <div className="min-w-0">
          {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
          <h1 className="ui-page-title">{title}</h1>
          {description && <p className="ui-page-description">{description}</p>}
        </div>
      </div>
    </div>
    {actions && <div className="ui-page-header__actions">{actions}</div>}
  </header>;
}

export function Card({ children, className = "", interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <section className={`ui-card ${interactive ? "ui-card--interactive" : ""} ${className}`}>{children}</section>;
}

type AlertTone = "info" | "success" | "warning" | "danger";
const alertIcons: Record<AlertTone, Icon> = { info: Info, success: CircleCheck, warning: CircleAlert, danger: CircleX };

export function Alert({ tone = "info", children, title, className = "" }: { tone?: AlertTone; children: ReactNode; title?: string; className?: string }) {
  const IconComponent = alertIcons[tone];
  return <div className={`ui-alert ui-alert--${tone} ${className}`} role={tone === "danger" ? "alert" : "status"}>
    <IconComponent size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
    <div className="min-w-0">{title && <p className="font-bold">{title}</p>}<div className={title ? "mt-0.5" : ""}>{children}</div></div>
  </div>;
}

export function EmptyState({ title = "Chưa có dữ liệu.", description, action, compact = false, className = "" }: { title?: string; description?: ReactNode; action?: ReactNode; compact?: boolean; className?: string }) {
  return <div className={`ui-empty-state ${compact ? "ui-empty-state--compact" : ""} ${className}`}>
    <Inbox size={compact ? 18 : 24} aria-hidden="true" />
    <div><p className="font-bold">{title}</p>{description && <p className="mt-1 text-sm">{description}</p>}</div>
    {action && <div className="mt-3">{action}</div>}
  </div>;
}

type StatusTone = "draft" | "review" | "published" | "archived" | "verified" | "unverified" | "private" | "public" | "permission" | "reference";
const statusLabels: Record<StatusTone, string> = {
  draft: "Bản nháp",
  review: "Đang rà soát",
  published: "Đã xuất bản",
  archived: "Đã lưu trữ",
  verified: "Đã xác minh",
  unverified: "Chưa xác minh",
  private: "Riêng tư",
  public: "Công khai",
  permission: "Đã cấp quyền",
  reference: "Công cụ tham khảo",
};

export function StatusBadge({ tone, label, className = "" }: { tone: StatusTone; label?: string; className?: string }) {
  return <span className={`ui-status-badge ui-status-badge--${tone} ${className}`}>{label || statusLabels[tone]}</span>;
}

export function IconButton({ label, icon: IconComponent, onClick, tone = "neutral", disabled = false, className = "" }: { label: string; icon: Icon; onClick: () => void; tone?: "neutral" | "primary" | "warning" | "danger" | "success"; disabled?: boolean; className?: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`ui-icon-button ui-icon-button--${tone} ${className}`}><IconComponent size={18} strokeWidth={2} /></button>;
}
