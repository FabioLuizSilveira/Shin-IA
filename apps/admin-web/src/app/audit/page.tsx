export const dynamic = "force-dynamic";

export default function AuditPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Audit Center</h1>
      <p style={{ color: "#5f6368" }}>Immutable audit trail for all platform events.</p>
      <div
        style={{
          marginTop: "1.5rem",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #dadce0",
          padding: "1rem",
        }}
      >
        <div style={{ color: "#5f6368", fontSize: "0.9rem" }}>No audit events to display.</div>
      </div>
    </div>
  );
}
