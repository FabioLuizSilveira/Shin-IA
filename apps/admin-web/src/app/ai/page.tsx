export const dynamic = "force-dynamic";

const AGENT_TYPES = ["Analytics", "Support", "Scheduling", "Commercial", "OCR"];

export default function AiPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>AI Center</h1>
      <p style={{ color: "#5f6368" }}>Configure and monitor AI agents across the platform.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {AGENT_TYPES.map((agent) => (
          <div
            key={agent}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5rem" }}>🤖</div>
            <div style={{ marginTop: "0.5rem", fontWeight: 600 }}>{agent}</div>
            <div style={{ fontSize: "0.75rem", color: "#5f6368", marginTop: "0.25rem" }}>Agent</div>
          </div>
        ))}
      </div>
    </div>
  );
}
