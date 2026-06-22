export const dynamic = "force-dynamic";

const SERVICES = [
  { name: "API Gateway", status: "healthy" },
  { name: "Database", status: "healthy" },
  { name: "Cache", status: "healthy" },
  { name: "Queue", status: "healthy" },
  { name: "Storage", status: "healthy" },
];

export default function ObservabilityPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Observability</h1>
      <p style={{ color: "#5f6368" }}>Platform health, metrics, and distributed tracing.</p>
      <div style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Service Health</h2>
        {SERVICES.map((svc) => (
          <div
            key={svc.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #dadce0",
              marginBottom: "0.5rem",
            }}
          >
            <span>{svc.name}</span>
            <span
              style={{
                color: svc.status === "healthy" ? "#1e8e3e" : "#d93025",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              {svc.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
