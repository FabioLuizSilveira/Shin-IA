import { Avatar, GlassCard } from "@shina/design-system";

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface TestimonialsProps {
  items: Testimonial[];
}

export function Testimonials({ items }: TestimonialsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {items.map((t) => (
        <GlassCard key={t.name} className="p-6">
          <p className="text-sm text-[var(--shina-text-primary)] leading-relaxed mb-5">
            “{t.quote}”
          </p>
          <div className="flex items-center gap-3">
            <Avatar name={t.name} src={t.avatarUrl} size="sm" />
            <div>
              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="text-xs text-[var(--shina-text-tertiary)]">{t.role}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
