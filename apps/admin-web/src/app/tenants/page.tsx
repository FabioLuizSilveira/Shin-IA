export const dynamic = "force-dynamic";

export default function TenantsPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Tenant Management</h1>
      <p style={{ color: "#5f6368" }}>Manage platform tenants, subscriptions and lifecycle.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {["Active", "Trial", "Suspended", "Churned"].map((status) => (
          <div
            key={status}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#5f6368", textTransform: "uppercase" }}>
              {status}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.25rem" }}>—</div>
          </div>
        ))}
      </div>
    </div>
  );
}
