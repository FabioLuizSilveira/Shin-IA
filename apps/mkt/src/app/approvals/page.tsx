import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { ShieldCheck } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <MktShell title="Aprovações">
      <ModulePlaceholder
        icon={ShieldCheck}
        title="Central de Aprovações"
        description="Revise e aprove rascunhos criados por usuários e agentes antes de qualquer publicação nas plataformas de ads."
        milestone="M-MKT-05"
      />
    </MktShell>
  );
}
