import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";

export const metadata: Metadata = {
  title: "Shinã",
  description: "Shinã Tenant Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, padding: "1.5rem", backgroundColor: "#f8f9fa" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
