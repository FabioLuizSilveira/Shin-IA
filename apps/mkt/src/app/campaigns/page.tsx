import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Megaphone } from "lucide-react";

export default function CampaignsPage() {
  return (
    <MktShell title="Campanhas">
      <ModulePlaceholder
        icon={Megaphone}
        title="Campanhas"
        description="Crie e gerencie campanhas em Meta, Google, TikTok e LinkedIn — sempre em modo rascunho até a aprovação."
        milestone="M-MKT-05"
      />
    </MktShell>
  );
}
