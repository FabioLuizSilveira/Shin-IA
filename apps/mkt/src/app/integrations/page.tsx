import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Plug } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <MktShell title="Integrações">
      <ModulePlaceholder
        icon={Plug}
        title="Integrações de Ads"
        description="Conecte Meta Ads, Google Ads, TikTok e LinkedIn via OAuth para ler performance e publicar campanhas aprovadas."
        milestone="M-MKT-05"
      />
    </MktShell>
  );
}
