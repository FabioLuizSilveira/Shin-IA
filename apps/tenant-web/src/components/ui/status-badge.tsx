interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "error" | "warning";
  label?: string;
}

const statusConfig = {
  active: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Ativo" },
  inactive: { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-100", label: "Inativo" },
  pending: { dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50", label: "Pendente" },
  error: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", label: "Erro" },
  warning: { dot: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50", label: "Alerta" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label ?? config.label}
    </span>
  );
}
