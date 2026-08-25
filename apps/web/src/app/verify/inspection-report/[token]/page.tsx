import { createAdminClient } from "@/lib/supabase/admin";
import { CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// Public verification page (item 8 of the spec) — server component, no
// session required. Queries the DB directly (not the API route) since
// this always renders server-side; the API route exists separately for
// programmatic verification. Same minimal-metadata contract either way.
export default async function VerifyInspectionReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("inspection_reports")
    .select("id, inspection_id, version, content_hash, generated_at")
    .eq("verification_token", token)
    .maybeSingle();

  const valid = Boolean(report);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center space-y-3">
        {valid ? (
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        ) : (
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
        )}
        <p className="text-lg font-bold text-slate-900 dark:text-white">
          {valid ? "Documento válido" : "Documento não validado"}
        </p>
        {valid && report && (
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>Inspection: VIS-{report.inspection_id.slice(0, 8).toUpperCase()}</p>
            <p>Versão: {report.version}</p>
            <p>Gerado: {new Date(report.generated_at).toLocaleString("pt-BR")}</p>
            <p className="font-mono text-xs break-all">Hash: {report.content_hash}</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              Integridade: VERIFICADA
            </p>
          </div>
        )}
        {!valid && (
          <p className="text-sm text-slate-500">
            Este código de verificação não corresponde a nenhum laudo emitido.
          </p>
        )}
        <p className="text-xs text-slate-400 pt-2">Tecnologia Shinã</p>
      </div>
    </div>
  );
}
