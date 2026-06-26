import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandMenu } from "@/components/ui/command-menu";

interface AppShellProps {
  children: ReactNode;
  title: string;
}

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="flex-1 bg-slate-50 p-6 overflow-auto">{children}</main>
      </div>
      <CommandMenu />
    </div>
  );
}
