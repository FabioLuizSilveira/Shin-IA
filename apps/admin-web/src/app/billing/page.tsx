export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Billing Portal</h1>
      <p style={{ color: "#5f6368" }}>
        Manage subscriptions, invoices, and revenue across all tenants.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {[
          { label: "Monthly Revenue", value: "R$ 0,00" },
          { label: "Outstanding", value: "R$ 0,00" },
          { label: "Open Invoices", value: "0" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#5f6368", textTransform: "uppercase" }}>
              {item.label}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.5rem" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
