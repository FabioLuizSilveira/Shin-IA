"use client";

// M33 gap — invoice-detail.tsx's "Imprimir" button has linked here since
// the invoices module was built, but this route never existed (404). No
// AppShell/sidebar on purpose — this is meant to be printed, not navigated.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import type { InvoiceDetail } from "@/types/domain";

interface Company {
  name: string;
  metadata: { support_email?: string; phone?: string };
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  voided: "Anulada",
};

export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${params.id}`).then((r) => r.json()),
      fetch("/api/tenant-settings/company").then((r) => r.json()),
    ])
      .then(
        ([invoiceJson, companyJson]: [
          { data?: InvoiceDetail; error?: string },
          { data?: Company },
        ]) => {
          if (invoiceJson.data) setInvoice(invoiceJson.data);
          else setError(invoiceJson.error ?? "Fatura não encontrada");
          if (companyJson.data) setCompany(companyJson.data);
        },
      )
      .catch(() => setError("Falha ao carregar a fatura"));
  }, [params.id]);

  if (error) {
    return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#DC2626" }}>{error}</div>;
  }

  if (!invoice) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#64748B" }}>Carregando...</div>
    );
  }

  const items = [...invoice.invoice_line_items].sort((a, b) => a.sort_order - b.sort_order);

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
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#2563EB",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <Printer size={16} /> Imprimir
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 40,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{company?.name ?? "Shinã"}</h1>
          {company?.metadata?.support_email && (
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
              {company.metadata.support_email}
            </p>
          )}
          {company?.metadata?.phone && (
            <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>
              {company.metadata.phone}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>FATURA</h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0", fontFamily: "monospace" }}>
            #{invoice.id.slice(0, 8).toUpperCase()}
          </p>
          <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>
            {STATUS_LABEL[invoice.status] ?? invoice.status}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              color: "#94A3B8",
              margin: "0 0 4px",
              letterSpacing: 0.5,
            }}
          >
            Cobrado de
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {invoice.billing_accounts?.organizations?.name ?? "—"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              color: "#94A3B8",
              margin: "0 0 4px",
              letterSpacing: 0.5,
            }}
          >
            Vencimento
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{formatDate(invoice.due_date)}</p>
          {invoice.paid_at && (
            <p style={{ fontSize: 13, color: "#059669", margin: "4px 0 0" }}>
              Pago em {formatDate(invoice.paid_at)}
            </p>
          )}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #0F172A" }}>
            <th
              style={{
                textAlign: "left",
                padding: "8px 4px",
                fontSize: 12,
                textTransform: "uppercase",
                color: "#64748B",
              }}
            >
              Descrição
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 4px",
                fontSize: 12,
                textTransform: "uppercase",
                color: "#64748B",
              }}
            >
              Qtd
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 4px",
                fontSize: 12,
                textTransform: "uppercase",
                color: "#64748B",
              }}
            >
              Unitário
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 4px",
                fontSize: 12,
                textTransform: "uppercase",
                color: "#64748B",
              }}
            >
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: "16px 4px", color: "#94A3B8", fontSize: 13 }}>
                Sem itens detalhados.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "10px 4px", fontSize: 14 }}>{item.description}</td>
                <td style={{ padding: "10px 4px", fontSize: 14, textAlign: "right" }}>
                  {item.quantity}
                </td>
                <td style={{ padding: "10px 4px", fontSize: 14, textAlign: "right" }}>
                  {brl(Number(item.unit_price_amount))}
                </td>
                <td
                  style={{ padding: "10px 4px", fontSize: 14, textAlign: "right", fontWeight: 600 }}
                >
                  {brl(Number(item.unit_price_amount) * item.quantity)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 260 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderTop: "2px solid #0F172A",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              {brl(Number(invoice.total_amount))}
            </span>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 56, fontSize: 11, color: "#94A3B8", textAlign: "center" }}>
        Gerado por {company?.name ?? "Shinã"} em {formatDate(new Date().toISOString())}.
      </p>
    </div>
  );
}
