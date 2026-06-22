export const dynamic = "force-dynamic";

const STATUSES = ["Pending", "In Progress", "Completed", "Overdue"];

export default function OperationsPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Operations</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {STATUSES.map((s) => (
          <div
            key={s}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#5f6368" }}>{s}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>0</div>
          </div>
        ))}
      </div>
    </div>
  );
}
