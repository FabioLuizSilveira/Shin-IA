"use client";

// Mesmo padrão de financial/invoices/[id]/print/page.tsx (M33) — página
// HTML estilizada para impressão via window.print(), sem AppShell/sidebar
// e sem biblioteca de PDF nova (decisão já validada com o usuário).
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

interface AcceptanceDetail {
  id: string;
  product: string;
  accepted_at: string;
  representative_name: string;
  representative_role: string;
  representative_document: string | null;
  declared_authority: boolean;
  document_hash: string;
  contract_versions: { title: string; version: number; content: string } | null;
  plan_versions: {
    name: string;
    price_cents: number;
    currency: string;
    billing_cycle: string;
  } | null;
  tenants: { name: string } | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrintAcceptancePage() {
  const params = useParams<{ acceptanceId: string }>();
  const [acceptance, setAcceptance] = useState<AcceptanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/commercial/acceptances/${params.acceptanceId}`)
      .then((r) => r.json() as Promise<{ data?: AcceptanceDetail; error?: string }>)
      .then((json) => {
        if (json.data) setAcceptance(json.data);
        else setError(json.error ?? "Aceite não encontrado");
      })
      .catch(() => setError("Falha ao carregar o aceite"));
  }, [params.acceptanceId]);

  if (error) {
    return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#DC2626" }}>{error}</div>;
  }
  if (!acceptance) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#64748B" }}>Carregando...</div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 32px",
        fontFamily: "sans-serif",
        color: "#0F172A",
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>

      <div
        className="no-print"
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}
      >
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "#2563EB",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{acceptance.contract_versions?.title}</h1>
      <p style={{ color: "#64748B", fontSize: 13, marginBottom: 32 }}>
        Versão {acceptance.contract_versions?.version} — Comprovante de aceite
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 32 }}>
        <tbody>
          {[
            ["Empresa (Tenant)", acceptance.tenants?.name ?? "—"],
            ["Plano", acceptance.plan_versions?.name ?? "—"],
            [
              "Representante",
              `${acceptance.representative_name} (${acceptance.representative_role})`,
            ],
            ["CPF", acceptance.representative_document ?? "—"],
            ["Poderes declarados", acceptance.declared_authority ? "Sim" : "Não"],
            ["Aceito em", formatDateTime(acceptance.accepted_at)],
            ["Hash do documento (SHA-256)", acceptance.document_hash],
          ].map(([label, value]) => (
            <tr key={label} style={{ borderBottom: "1px solid #E2E8F0" }}>
              <td style={{ padding: "8px 0", color: "#64748B", width: 220 }}>{label}</td>
              <td
                style={{
                  padding: "8px 0",
                  fontFamily: label.includes("Hash") ? "monospace" : undefined,
                  wordBreak: "break-all",
                }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Texto do contrato aceito</h2>
      <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {acceptance.contract_versions?.content}
      </div>
    </div>
  );
}
