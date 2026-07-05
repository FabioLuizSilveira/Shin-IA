export interface LogoCloudProps {
  label?: string;
  logos: string[];
}

export function LogoCloud({ label = "Confiado por empresas líderes", logos }: LogoCloudProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs text-[var(--shina-text-tertiary)] uppercase tracking-widest">{label}</p>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {logos.map((logo) => (
          <span
            key={logo}
            className="text-sm font-semibold text-[var(--shina-text-tertiary)] hover:text-[var(--shina-text-secondary)] transition-colors duration-fast"
          >
            {logo}
          </span>
        ))}
      </div>
    </div>
  );
}
