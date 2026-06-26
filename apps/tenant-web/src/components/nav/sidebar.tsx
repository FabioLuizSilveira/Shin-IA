import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/operations", label: "Operations" },
  { href: "/assets", label: "Fleet & Assets" },
  { href: "/contracts", label: "Contracts" },
  { href: "/financial", label: "Financial" },
  { href: "/commissions", label: "Commissions" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <nav
      style={{
        width: "220px",
        minHeight: "100vh",
        backgroundColor: "#0d47a1",
        color: "#fff",
        padding: "1.5rem 0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "0 1.25rem 1.5rem", fontWeight: 700, fontSize: "1.1rem" }}>
        Shinã Portal
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
        {NAV_ITEMS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              style={{
                display: "block",
                padding: "0.6rem 1.25rem",
                color: "#bbdefb",
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
