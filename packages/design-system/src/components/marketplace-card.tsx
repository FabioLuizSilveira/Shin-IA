import { Star } from "@shina/icons";
import { GlassCard } from "./glass-card";
import { Badge } from "./badge";

export interface MarketplaceCardProps {
  title: string;
  author: string;
  price: string;
  rating: number;
  preview?: string;
  onOpen: () => void;
}

export function MarketplaceCard({
  title,
  author,
  price,
  rating,
  preview,
  onOpen,
}: MarketplaceCardProps) {
  return (
    <GlassCard interactive onClick={onOpen} className="p-0 overflow-hidden">
      <div
        className="h-32 bg-[image:var(--shina-gradient)] bg-cover bg-center"
        style={preview ? { backgroundImage: `url(${preview})` } : undefined}
      />
      <div className="p-4">
        <h4 className="text-sm font-bold text-[var(--shina-text-title)] truncate">{title}</h4>
        <p className="text-xs text-[var(--shina-text-tertiary)] mb-2">por {author}</p>
        <div className="flex items-center justify-between">
          <Badge variant="neutral">{price}</Badge>
          <span className="flex items-center gap-1 text-xs text-[var(--shina-text-secondary)]">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            {rating.toFixed(1)}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
