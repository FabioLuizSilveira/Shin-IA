import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Copy } from "lucide-react";

export default function ClonerPage() {
  return (
    <MktShell title="Ad Cloner">
      <ModulePlaceholder
        icon={Copy}
        title="Ad Cloner"
        description="Clone anúncios de referência e adapte layout, cores, textos e produto para a sua marca."
        milestone="M-MKT-04"
      />
    </MktShell>
  );
}
