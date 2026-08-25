"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ClipboardCheck } from "lucide-react";

interface InspectionListItem {
  id: string;
  type: string;
  status: string;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  pre_delivery: "Pré-entrega",
  check_in: "Check-in",
  check_out: "Check-out",
  return: "Retorno",
  periodic: "Periódica",
  maintenance: "Manutenção",
  damage: "Avaria",
  custom: "Personalizada",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  pending_review: "Aguardando sua revisão",
  completed: "Concluída",
  rejected: "Reprovada",
  abandoned: "Abandonada",
};

// Customer-side entry point for item 3 of the spec (P0). Contract id
// comes from the route (same segment shape as rentals/[id]/contract),
// inspections are fetched scoped by contractId + the customer's own
// customer_id (server-enforced by /api/mobile/customer/inspections,
// never trusted from this page).
export default function RentalInspectionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contractId = params.id;

  const [inspections, setInspections] = useState<InspectionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/mobile/customer/inspections?contractId=${contractId}`)
      .then((r) => r.json())
      .then((j: { data: InspectionListItem[] }) => setInspections(j.data ?? []))
      .catch((err: Error) => setError(err.message));
  }, [contractId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/rentals/${contractId}`)}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Vistorias</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-3">
        {inspections === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : inspections.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">
            Nenhuma vistoria disponível para este contrato.
          </p>
        ) : (
          inspections.map((insp) => (
            <button
              key={insp.id}
              onClick={() => router.push(`/rentals/${contractId}/inspections/${insp.id}`)}
              className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 cursor-pointer"
            >
              <ClipboardCheck className="w-5 h-5 text-shina-blue shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {TYPE_LABEL[insp.type] ?? insp.type}
                </p>
                <p className="text-xs text-slate-500">
                  {STATUS_LABEL[insp.status] ?? insp.status} ·{" "}
                  {new Date(insp.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
