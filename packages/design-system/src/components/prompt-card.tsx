import { Star, Copy as CopyIcon } from "@shina/icons";
import { GlassCard } from "./glass-card";
import { Badge } from "./badge";
import { IconButton } from "./icon-button";

export interface PromptCardProps {
  name: string;
  category: string;
  usageCount: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onCopy?: () => void;
  onRun?: () => void;
}

/** Prompt Card (doc 10). Compacto e denso — biblioteca de prompts. */
export function PromptCard({
  name,
  category,
  usageCount,
  isFavorite,
  onToggleFavorite,
  onCopy,
  onRun,
}: PromptCardProps) {
  return (
    <GlassCard interactive={Boolean(onRun)} onClick={onRun} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--shina-text-title)] truncate">{name}</p>
          <Badge variant="neutral" className="mt-1.5">
            {category}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onCopy && (
            <IconButton
              icon={<CopyIcon size={14} />}
              aria-label="Copiar prompt"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
            />
          )}
          {onToggleFavorite && (
            <IconButton
              icon={
                <Star
                  size={14}
                  className={isFavorite ? "fill-amber-400 text-amber-400" : undefined}
                />
              }
              aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            />
          )}
        </div>
      </div>
      <p className="text-[11px] text-[var(--shina-text-tertiary)] mt-2">{usageCount} usos</p>
    </GlassCard>
  );
}
