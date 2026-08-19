import Link from "next/link";

// Stripe Checkout requires a real https success_url/cancel_url — a custom
// app scheme (shinacustomer://...) isn't accepted. This is that landing
// page: the mobile app opens Checkout in an in-app browser and relies on
// the user closing it to return (RenewalScreen/RentalsListScreen already
// refetch on focus), so this page's only job is telling them that's safe
// to do — the actual state change happens via the Stripe webhook
// independently of whether anyone ever sees this page.
export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const { status, kind } = await searchParams;
  const success = status === "success";

  const kindLabel: Record<string, string> = {
    renewal: "Renovação",
    deposit: "Sinal",
    balance: "Saldo",
  };
  const label = kindLabel[kind ?? ""] ?? "Pagamento";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        background: "#0F172A",
        color: "#F8FAFC",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, margin: 0 }}>
        {success ? `${label} confirmado(a)` : `${label} cancelado(a)`}
      </h1>
      <p style={{ color: "#94A3B8", maxWidth: 320, margin: 0 }}>
        {success
          ? "Você pode fechar esta janela e voltar para o app Shinã."
          : "Nenhuma cobrança foi feita. Você pode fechar esta janela e tentar novamente no app."}
      </p>
      <Link href="/" style={{ color: "#06B6D4", fontSize: 14 }}>
        Ir para app.shinaia.com.br
      </Link>
    </div>
  );
}
