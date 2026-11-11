import { useState, type ButtonHTMLAttributes, type ComponentType, type ReactNode, type SVGProps } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

export type IconType = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: IconType;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "grad-primary text-white shadow-md shadow-accent/25 hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-ink border border-line shadow-xs hover:border-accent/50 hover:bg-surface2/70",
  ghost: "text-mute hover:text-ink hover:bg-ink/5",
  danger: "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20",
};

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-all duration-200 select-none disabled:opacity-50 whitespace-nowrap",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading ? <Spinner className="h-4 w-4" /> : Icon ? <Icon className="h-[18px] w-[18px]" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconType; label: string; active?: boolean }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-mute transition-all duration-200 hover:bg-ink/10 hover:text-ink disabled:opacity-40",
        active && "bg-accent/15 text-accent",
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-all duration-200",
        checked ? "grad-primary shadow-sm shadow-accent/30" : "bg-ink/20",
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", checked && "translate-x-5")} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: IconType }[];
}) {
  return (
    <div className="inline-flex rounded-[8px] border border-line bg-surface2 p-1" role="tablist">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-xs font-semibold transition-all duration-200",
              active
                ? "grad-primary text-white shadow-sm shadow-accent/30"
                : "text-mute hover:text-ink",
            )}
          >
            {o.icon && <o.icon className="h-4 w-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 rounded-[8px] border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors hover:border-accent/50 focus:border-accent",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface text-ink">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Confirmación en línea (sin ventanas emergentes) para acciones destructivas */
export function ConfirmButton({
  label,
  confirmLabel = "Confirmar",
  icon,
  onConfirm,
  size = "md",
  iconOnly,
}: {
  label: string;
  confirmLabel?: string;
  icon?: IconType;
  onConfirm: () => void;
  size?: "sm" | "md";
  iconOnly?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return iconOnly && icon ? (
      <IconButton icon={icon} label={label} onClick={() => setAsking(true)} className="hover:text-red-500" />
    ) : (
      <Button variant="danger" size={size} icon={icon} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[8px] border border-red-500/40 bg-red-500/10 p-1 anim-fade-up" role="alertdialog" aria-label={`Confirmar: ${label}`}>
      <span className="px-2 text-xs font-medium text-red-500">¿Seguro?</span>
      <button
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className="inline-flex h-7 items-center gap-1 rounded-[6px] bg-red-500 px-2.5 text-xs font-semibold text-white hover:bg-red-400"
      >
        <CheckIcon className="h-4 w-4" />
        {confirmLabel}
      </button>
      <button onClick={() => setAsking(false)} aria-label="Cancelar" className="grid h-7 w-7 place-items-center rounded-[6px] text-mute hover:bg-ink/10 hover:text-ink">
        <XMarkIcon className="h-4 w-4" />
      </button>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
  className,
}: {
  icon: IconType;
  title: string;
  text?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[10px] border border-dashed border-line bg-surface/60 px-6 py-14 text-center anim-fade-up", className)}>
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-[10px] grad-primary-br text-white shadow-lg shadow-accent/30">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-mute">{text}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, action }: { icon?: IconType; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent/15 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        )}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent", className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-[10px]", className)} />;
}
