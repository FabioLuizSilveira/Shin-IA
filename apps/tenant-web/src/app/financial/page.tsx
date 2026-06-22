export const dynamic = "force-dynamic";

export default function FinancialPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Financial</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        {[
          { label: "Gross Revenue", value: "R$ 0" },
          { label: "Total Costs", value: "R$ 0" },
          { label: "Net Profit", value: "R$ 0" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#5f6368", textTransform: "uppercase" }}>
              {label}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.5rem" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
