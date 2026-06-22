export const dynamic = "force-dynamic";

interface TenantDetailPageProps {
  params: { id: string };
}

export default function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = params;
  return (
    <div>
      <h1 style={{ margin: "0 0 1rem" }}>Tenant Detail</h1>
      <p style={{ color: "#5f6368" }}>Tenant ID: {id}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {["Overview", "Billing", "Users", "Integrations"].map((section) => (
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
