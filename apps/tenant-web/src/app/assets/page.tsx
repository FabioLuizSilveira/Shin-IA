export const dynamic = "force-dynamic";

export default function AssetsPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Fleet & Assets</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {["Available", "Rented", "Maintenance", "Retired"].map((status) => (
          <div
            key={status}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#5f6368" }}>{status}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>0</div>
          </div>
        ))}
      </div>
    </div>
  );
}
