import { GlassCard } from "./glass-card";
import { Badge, type BadgeVariant } from "./badge";

export interface CampaignCardProps {
  name: string;
  platform: string;
  status: string;
  statusVariant: BadgeVariant;
  metricLabel?: string;
  metricValue?: string;
  onOpen?: () => void;
}

/** Campaign Card (doc 10). Ring âmbar quando pendente de aprovação. */
export function CampaignCard({
  name,
  platform,
  status,
  statusVariant,
  metricLabel,
  metricValue,
  onOpen,
}: CampaignCardProps) {
  return (
    <GlassCard
      interactive={Boolean(onOpen)}
      onClick={onOpen}
      ring={statusVariant === "warning" ? "warning" : "none"}
      className="p-4 flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--shina-text-title)] truncate">{name}</p>
        <p className="text-xs text-[var(--shina-text-tertiary)]">{platform}</p>
      </div>
      {metricValue && (
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-[var(--shina-text-primary)] tabular-nums">
            {metricValue}
          </p>
          {metricLabel && (
            <p className="text-[10px] text-[var(--shina-text-tertiary)]">{metricLabel}</p>
          )}
        </div>
      )}
      <Badge variant={statusVariant}>{status}</Badge>
    </GlassCard>
  );
}
