export const dynamic = "force-dynamic";

export default function ContractsPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Contracts</h1>
      <p style={{ color: "#5f6368" }}>Manage your rental contracts and agreements.</p>
      <div
        style={{
          marginTop: "1.5rem",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #dadce0",
          padding: "1rem",
        }}
      >
        <div style={{ color: "#5f6368", fontSize: "0.9rem" }}>No contracts to display.</div>
      </div>
    </div>
  );
}
