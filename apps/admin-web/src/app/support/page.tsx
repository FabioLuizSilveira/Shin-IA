export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Support Center</h1>
      <p style={{ color: "#5f6368" }}>Manage tenant support tickets across N1, N2, and N3 tiers.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {[
          { tier: "N1", count: 0, color: "#1a73e8" },
          { tier: "N2", count: 0, color: "#fbbc04" },
          { tier: "N3", count: 0, color: "#d93025" },
        ].map(({ tier, count, color }) => (
          <div
            key={tier}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: `2px solid ${color}`,
            }}
          >
            <strong style={{ color }}>{tier} Support</strong>
            <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.5rem" }}>{count}</div>
            <div style={{ fontSize: "0.8rem", color: "#5f6368" }}>Open tickets</div>
          </div>
        ))}
      </div>
    </div>
  );
}
