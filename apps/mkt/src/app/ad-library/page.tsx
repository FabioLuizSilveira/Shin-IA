import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Library } from "lucide-react";

export default function AdLibraryPage() {
  return (
    <MktShell title="Ad Library">
      <ModulePlaceholder
        icon={Library}
        title="Ad Library"
        description="Pesquise anúncios de concorrentes, filtre por plataforma e salve criativos vencedores no seu swipe file."
        milestone="M-MKT-02"
      />
    </MktShell>
  );
}
