"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ShinaDrawer } from "./shina-drawer";

// Tenant-only entry point for the Shinã Agent (mirrors how NotificationBell
// itself is only rendered on the non-platform branch of topbar.tsx). Kept
// as a standalone component so command-menu.tsx's own Cmd+K search stays
// completely untouched — this is a separate trigger, not a second "mode"
// bolted onto that hand-rolled component.
export function ShinaTriggerButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors bg-transparent border-0 cursor-pointer"
        title="Falar com a Shinã"
      >
        <Sparkles className="w-4 h-4" />
      </button>
      <ShinaDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
