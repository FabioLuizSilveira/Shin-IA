export const dynamic = "force-dynamic";

const STAGES = ["Prospect", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];

export default function CrmPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>CRM — Pipeline</h1>
      <p style={{ color: "#5f6368" }}>Leads, partners, and franchise pipeline management.</p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", overflowX: "auto" }}>
        {STAGES.map((stage) => (
          <div
            key={stage}
            style={{
              minWidth: "180px",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
              padding: "1rem",
            }}
          >
            <strong style={{ fontSize: "0.85rem" }}>{stage}</strong>
            <div style={{ marginTop: "1rem", color: "#5f6368", fontSize: "0.8rem" }}>0 leads</div>
          </div>
        ))}
      </div>
    </div>
  );
}
