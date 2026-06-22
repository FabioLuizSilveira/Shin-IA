export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Integration Center</h1>
      <p style={{ color: "#5f6368" }}>
        Monitor and manage all external integrations across tenants.
      </p>
      <div style={{ marginTop: "1.5rem" }}>
        {["Active Providers", "Webhook Endpoints", "Sync Jobs", "API Keys"].map((section) => (
          <div
            key={section}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "1rem",
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #dadce0",
              marginBottom: "0.5rem",
            }}
          >
            <span>{section}</span>
            <span style={{ fontWeight: 700 }}>0</span>
          </div>
        ))}
      </div>
    </div>
  );
}
