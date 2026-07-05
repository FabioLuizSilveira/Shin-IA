import { cn } from "../utils/cn";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg";
  statusDot?: "online" | "offline" | "busy";
  className?: string;
}

const SIZE_CLASSES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
} as const;

const STATUS_CLASSES = {
  online: "bg-emerald-400",
  offline: "bg-slate-500",
  busy: "bg-amber-400",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, src, size = "md", statusDot, className }: AvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "rounded-full flex items-center justify-center font-bold text-white overflow-hidden",
          "bg-[image:var(--shina-gradient)]",
          SIZE_CLASSES[size],
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      {statusDot && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--shina-surface-background)]",
            STATUS_CLASSES[statusDot],
          )}
        />
      )}
    </span>
  );
}
