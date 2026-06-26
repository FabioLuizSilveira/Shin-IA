import Link from "next/link";

const NAV_ITEMS = [
  { href: "/tenants", label: "Tenants" },
  { href: "/users", label: "Usuários" },
  { href: "/billing", label: "Billing" },
  { href: "/crm", label: "CRM" },
  { href: "/observability", label: "Observability" },
  { href: "/audit", label: "Audit" },
  { href: "/support", label: "Support" },
  { href: "/integrations", label: "Integrations" },
  { href: "/ai", label: "AI Center" },
];

export function Sidebar() {
  return (
    <nav
      style={{
        width: "220px",
        minHeight: "100vh",
        backgroundColor: "#1a1a2e",
        color: "#fff",
        padding: "1.5rem 0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "0 1.25rem 1.5rem",
          fontWeight: 700,
          fontSize: "1.1rem",
          letterSpacing: "-0.01em",
        }}
      >
        Shinã Admin
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
        {NAV_ITEMS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              style={{
                display: "block",
                padding: "0.6rem 1.25rem",
                color: "#c8cdd6",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
