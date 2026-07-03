import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <MktShell title="Configurações">
      <ModulePlaceholder
        icon={Settings}
        title="Configurações"
        description="Workspace, provedores de IA (BYOK), limites de orçamento, membros e permissões."
        milestone="M-MKT-11"
      />
    </MktShell>
  );
}
