export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ margin: "0 0 1.5rem" }}>Settings</h1>
      <p style={{ color: "#5f6368" }}>Configure your portal appearance, users, and integrations.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {["White Label", "Users & Roles", "Integrations", "Notifications"].map((section) => (
          <div
            key={section}
            style={{
              padding: "1rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #dadce0",
            }}
          >
            <strong>{section}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
