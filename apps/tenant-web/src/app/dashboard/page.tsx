export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Dashboard</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {[
          { label: "Active Contracts", value: "0" },
          { label: "Fleet Available", value: "0" },
          { label: "Revenue (MTD)", value: "R$ 0" },
          { label: "Open Operations", value: "0" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#5f6368", textTransform: "uppercase" }}>
              {label}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.25rem" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
