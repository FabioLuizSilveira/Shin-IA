import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Callback do OAuth (Google/Facebook) iniciado em /signup. Troca o code
// pela sessão e devolve o usuário para /signup com o plano escolhido
// preservado — o pagamento continua sendo um passo explícito (botão
// "Continuar para pagamento"), a conta não é ativada só pelo login social.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const plan = searchParams.get("plan") ?? "starter";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/signup?plan=${plan}`);
    }
  }

  return NextResponse.redirect(`${origin}/signup?error=auth`);
}
