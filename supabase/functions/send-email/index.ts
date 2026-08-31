import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailPayload {
  to: string;
  template: "welcome" | "invite" | "operation_alert" | "invoice_due" | "new_lead";
  data: Record<string, string | number | boolean>;
}

interface ResendResponse {
  id: string;
  error?: { message: string };
}

// ─── Template builders ────────────────────────────────────────────────────────

const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://www.shinaia.com.br";
const BRAND_COLOR = "#2563EB";

function buildHtmlWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:28px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${BRAND_COLOR};border-radius:10px;padding:8px 12px;">
                    <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">S</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Shinã</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;background:#f8fafc;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                © ${new Date().getFullYear()} Shinã Platform · <a href="${APP_URL}" style="color:#64748b;text-decoration:none;">${APP_URL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function templateWelcome(data: Record<string, string | number | boolean>): {
  subject: string;
  html: string;
  text: string;
} {
  const name = String(data.name ?? "");
  const tenantName = String(data.tenant_name ?? "");
  const loginUrl = String(data.login_url ?? `${APP_URL}/login`);

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Bem-vindo à Shinã! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Olá, <strong>${name}</strong>! Sua conta na plataforma <strong>${tenantName}</strong> está pronta.
      Agora você pode gerenciar sua frota, operações e muito mais.
    </p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:#0369a1;font-weight:600;">🚀 Próximos passos</p>
      <ul style="margin:8px 0 0;padding:0 0 0 20px;font-size:14px;color:#475569;line-height:1.8;">
        <li>Complete seu perfil em Configurações</li>
        <li>Cadastre seus primeiros ativos e recursos</li>
        <li>Crie sua primeira operação</li>
      </ul>
    </div>
    <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
      Acessar a plataforma →
    </a>`;

  return {
    subject: `Bem-vindo à Shinã, ${name}!`,
    html: buildHtmlWrapper(`Bem-vindo à Shinã`, body),
    text: `Olá ${name}! Sua conta na ${tenantName} está pronta. Acesse: ${loginUrl}`,
  };
}

function templateInvite(data: Record<string, string | number | boolean>): {
  subject: string;
  html: string;
  text: string;
} {
  const inviterName = String(data.inviter_name ?? "Um colega");
  const tenantName = String(data.tenant_name ?? "");
  const acceptUrl = String(data.accept_url ?? `${APP_URL}/login`);
  const role = String(data.role ?? "usuário");

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Você foi convidado! 👋</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      <strong>${inviterName}</strong> convidou você para fazer parte de <strong>${tenantName}</strong> na plataforma Shinã
      como <strong>${role}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#166534;">
        ⏰ Este convite expira em <strong>7 dias</strong>. Aceite logo para não perder o acesso.
      </p>
    </div>
    <a href="${acceptUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
      Aceitar convite →
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
      Ou cole este link no navegador: <a href="${acceptUrl}" style="color:#64748b;">${acceptUrl}</a>
    </p>`;

  return {
    subject: `${inviterName} convidou você para ${tenantName}`,
    html: buildHtmlWrapper(`Convite para ${tenantName}`, body),
    text: `${inviterName} convidou você para ${tenantName} na Shinã. Aceite: ${acceptUrl}`,
  };
}

function templateOperationAlert(data: Record<string, string | number | boolean>): {
  subject: string;
  html: string;
  text: string;
} {
  const opId = String(data.operation_id ?? "")
    .slice(0, 8)
    .toUpperCase();
  const opType = String(data.operation_type ?? "Operação");
  const status = String(data.status ?? "");
  const resource = String(data.resource_name ?? "—");
  const dashboardUrl = `${APP_URL}/operations`;

  const statusLabel: Record<string, string> = {
    in_progress: "Em Andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
    failed: "Falhou",
    pending: "Pendente",
  };
  const statusColor: Record<string, string> = {
    in_progress: "#2563EB",
    completed: "#10B981",
    cancelled: "#6B7280",
    failed: "#EF4444",
    pending: "#F59E0B",
  };

  const label = statusLabel[status] ?? status;
  const color = statusColor[status] ?? "#6B7280";

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Atualização de Operação</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      A operação <strong>#${opId}</strong> teve seu status atualizado.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:28px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Tipo</span><br/>
            <span style="font-size:15px;font-weight:600;color:#0f172a;">${opType}</span>
          </td>
          <td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Recurso</span><br/>
            <span style="font-size:15px;font-weight:600;color:#0f172a;">${resource}</span>
          </td>
          <td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Status</span><br/>
            <span style="display:inline-block;background:${color}1a;color:${color};font-size:13px;font-weight:700;padding:3px 10px;border-radius:20px;margin-top:4px;">${label}</span>
          </td>
        </tr>
      </table>
    </div>
    <a href="${dashboardUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
      Ver no dashboard →
    </a>`;

  return {
    subject: `Operação #${opId} — ${label}`,
    html: buildHtmlWrapper(`Operação #${opId}`, body),
    text: `Operação #${opId} (${opType}) está agora: ${label}. Recurso: ${resource}. Ver em: ${dashboardUrl}`,
  };
}

function templateInvoiceDue(data: Record<string, string | number | boolean>): {
  subject: string;
  html: string;
  text: string;
} {
  const invoiceId = String(data.invoice_id ?? "")
    .slice(0, 8)
    .toUpperCase();
  const amount = Number(data.amount ?? 0);
  const dueDate = String(data.due_date ?? "");
  const billingUrl = `${APP_URL}/financial`;

  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);

  const formattedDue = new Date(dueDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Fatura vencendo em breve</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      A fatura <strong>#${invoiceId}</strong> vence em <strong>${formattedDue}</strong>.
      Realize o pagamento para manter seus serviços ativos.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#92400e;">Valor total</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:#0f172a;">${formattedAmount}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#92400e;">Vencimento: ${formattedDue}</p>
    </div>
    <a href="${billingUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
      Visualizar fatura →
    </a>`;

  return {
    subject: `Fatura #${invoiceId} vence em breve — ${formattedAmount}`,
    html: buildHtmlWrapper(`Fatura #${invoiceId}`, body),
    text: `Fatura #${invoiceId} de ${formattedAmount} vence em ${formattedDue}. Ver em: ${billingUrl}`,
  };
}

function templateNewLead(data: Record<string, string | number | boolean>): {
  subject: string;
  html: string;
  text: string;
} {
  const companyName = String(data.company_name ?? "");
  const contactName = String(data.contact_name ?? "");
  const contactEmail = String(data.contact_email ?? "");
  const message = String(data.message ?? "");
  const leadUrl = String(data.lead_url ?? `${APP_URL}/platform/crm`);

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Novo lead pelo site 🎯</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Alguém preencheu o formulário de contato em shinaia.com.br e já caiu no CRM comercial.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;">
        <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Empresa</span><br/>
        <span style="font-size:15px;font-weight:600;color:#0f172a;">${companyName}</span>
      </p>
      <p style="margin:0 0 10px;">
        <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Contato</span><br/>
        <span style="font-size:15px;font-weight:600;color:#0f172a;">${contactName} · ${contactEmail}</span>
      </p>
      <p style="margin:0;">
        <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Mensagem</span><br/>
        <span style="font-size:14px;color:#334155;white-space:pre-wrap;">${message}</span>
      </p>
    </div>
    <a href="${leadUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
      Ver no CRM →
    </a>`;

  return {
    subject: `Novo lead: ${companyName || contactName}`,
    html: buildHtmlWrapper(`Novo lead — ${companyName}`, body),
    text: `Novo lead pelo site: ${companyName} (${contactName}, ${contactEmail}). Mensagem: ${message}. Ver em: ${leadUrl}`,
  };
}

// ─── Send via Resend API ───────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");

  if (!apiKey) {
    console.warn("[send-email] RESEND_API_KEY not set — email not sent (dev mode)");
    return { success: true, id: "dev-mode-no-send" };
  }

  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@shinaia.com.br";
  const fromName = Deno.env.get("FROM_NAME") ?? "Shinã Platform";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  // Read as text first, not res.json() directly -- an error response shape
  // Resend didn't document (or a non-JSON body on a 5xx) used to throw here
  // uncaught and/or collapse into the generic "Resend API error" fallback
  // below with zero diagnostic info, which is exactly what happened live
  // the first time this template was tested (a real Resend failure came
  // back as just "Resend API error", no way to tell why from the caller).
  const rawBody = await res.text();
  let json: ResendResponse | Record<string, unknown> = {};
  try {
    json = JSON.parse(rawBody) as ResendResponse;
  } catch {
    // non-JSON body -- rawBody itself becomes the error detail below
  }

  if (!res.ok || (json as ResendResponse).error) {
    const detail =
      (json as ResendResponse).error?.message ??
      (json as { message?: string }).message ??
      (rawBody ? rawBody.slice(0, 300) : `HTTP ${res.status}`);
    console.error(`[send-email] Resend API error (status=${res.status}):`, rawBody);
    return { success: false, error: `Resend API error: ${detail}` };
  }

  return { success: true, id: (json as ResendResponse).id };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let payload: EmailPayload;
  try {
    payload = (await req.json()) as EmailPayload;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload.to || !payload.template) {
    return Response.json({ error: "Missing required fields: to, template" }, { status: 422 });
  }

  let template: { subject: string; html: string; text: string };

  switch (payload.template) {
    case "welcome":
      template = templateWelcome(payload.data);
      break;
    case "invite":
      template = templateInvite(payload.data);
      break;
    case "operation_alert":
      template = templateOperationAlert(payload.data);
      break;
    case "invoice_due":
      template = templateInvoiceDue(payload.data);
      break;
    case "new_lead":
      template = templateNewLead(payload.data);
      break;
    default:
      return Response.json(
        { error: `Unknown template: ${payload.template as string}` },
        { status: 422 },
      );
  }

  const result = await sendEmail(payload.to, template.subject, template.html, template.text);

  if (!result.success) {
    console.error("[send-email] Failed to send:", result.error);
    return Response.json({ error: result.error }, { status: 502 });
  }

  console.log(`[send-email] Sent template=${payload.template} to=${payload.to} id=${result.id}`);

  return Response.json({ success: true, id: result.id }, { status: 200 });
});
