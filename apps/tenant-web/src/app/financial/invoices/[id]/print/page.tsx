import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, billing_accounts(*, organizations(name, document, address_city, address_state))")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!invoice) notFound();

  const { data: lineItems } = await admin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");

  const ba = invoice.billing_accounts as unknown as {
    cycle: string;
    organizations?: {
      name: string;
      document: string;
      address_city: string;
      address_state: string;
    };
  } | null;
  const org = ba?.organizations;

  const brl = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: invoice.total_currency }).format(
      v,
    );

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    issued: "Emitida",
    paid: "Paga",
    overdue: "Vencida",
    cancelled: "Cancelada",
    voided: "Anulada",
  };

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; background: white; padding: 48px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; border-bottom: 2px solid #0f172a; padding-bottom: 24px; }
    .brand { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: 20px; font-weight: 700; color: #0f172a; }
    .invoice-status { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 6px; background: #dbeafe; color: #1d4ed8; }
    .invoice-status.paid { background: #dcfce7; color: #15803d; }
    .invoice-status.overdue { background: #fee2e2; color: #dc2626; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
    .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
    .party .name { font-size: 16px; font-weight: 600; }
    .party .detail { font-size: 13px; color: #475569; margin-top: 3px; }
    .dates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; padding: 16px; background: #f8fafc; border-radius: 8px; }
    .date-item h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 4px; }
    .date-item p { font-size: 14px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    th:not(:first-child) { text-align: right; }
    td { padding: 12px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    td:not(:first-child) { text-align: right; }
    .total-row { border-top: 2px solid #0f172a; }
    .total-row td { font-size: 16px; font-weight: 700; padding: 16px 12px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    .no-print { margin-bottom: 24px; display: flex; gap: 12px; }
    .btn-print { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-back { display: flex; align-items: center; padding: 8px 16px; background: #f1f5f9; color: #0f172a; border: none; border-radius: 8px; font-size: 14px; text-decoration: none; }
    @media print {
      body { padding: 24px; }
      .no-print { display: none !important; }
    }
  `;

  return (
    <html lang="pt-BR">
      <head>
        <title>Fatura {invoice.id.slice(0, 8).toUpperCase()}</title>
        <meta charSet="utf-8" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <div className="no-print">
          <button className="btn-print">Imprimir / Salvar PDF</button>
          <a href="/financial" className="btn-back">
            Voltar
          </a>
        </div>

        <div className="header">
          <div>
            <div className="brand">Shinã</div>
            <div className="brand-sub">Plataforma de Gestão</div>
          </div>
          <div className="invoice-meta">
            <div className="invoice-number">FATURA #{invoice.id.slice(0, 8).toUpperCase()}</div>
            <div className={`invoice-status ${invoice.status}`}>
              {statusLabels[invoice.status] ?? invoice.status}
            </div>
          </div>
        </div>

        <div className="parties">
          <div className="party">
            <h3>Emitente</h3>
            <div className="name">Acme Logística</div>
            <div className="detail">CNPJ: 00.000.000/0001-00</div>
            <div className="detail">São Paulo, SP</div>
          </div>
          {org && (
            <div className="party">
              <h3>Destinatário</h3>
              <div className="name">{org.name}</div>
              <div className="detail">CNPJ: {org.document}</div>
              <div className="detail">
                {org.address_city}, {org.address_state}
              </div>
            </div>
          )}
        </div>

        <div className="dates">
          <div className="date-item">
            <h4>Data de Emissão</h4>
            <p>{new Date(invoice.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="date-item">
            <h4>Vencimento</h4>
            <p>{new Date(invoice.due_date).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="date-item">
            <h4>Pago em</h4>
            <p>{invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString("pt-BR") : "—"}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Preço Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(lineItems ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{brl(Number(item.unit_price_amount))}</td>
                <td>{brl(Number(item.unit_price_amount) * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={3}>Total</td>
              <td>{brl(Number(invoice.total_amount))}</td>
            </tr>
          </tfoot>
        </table>

        <div className="footer">
          Gerado por Shinã Platform · {new Date().toLocaleDateString("pt-BR")}
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.querySelector('.btn-print')?.addEventListener('click', function() {
                window.print();
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
