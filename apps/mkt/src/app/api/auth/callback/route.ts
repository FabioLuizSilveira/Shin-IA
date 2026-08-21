import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Callback do OAuth (Google/Facebook) e magic link, usado por dois fluxos:
// /signup (cria conta, mantém o plano escolhido, pagamento continua um
// passo explícito) e /login (conta já existente, sem senha). O parâmetro
// `next` é o que diferencia os dois — /signup nunca o envia (mantém o
// comportamento antigo, redireciona pro checkout de plano), /login sempre
// envia (validado como path interno — nunca uma URL externa, evita open
// redirect).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const plan = searchParams.get("plan") ?? "starter";
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next ?? `/signup?plan=${plan}`}`);
    }
  }

  return NextResponse.redirect(`${origin}${next ? "/login" : "/signup"}?error=auth`);
}
