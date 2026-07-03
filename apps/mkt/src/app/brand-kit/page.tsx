import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Palette } from "lucide-react";

export default function BrandKitPage() {
  return (
    <MktShell title="Brand Kit">
      <ModulePlaceholder
        icon={Palette}
        title="Brand Kit"
        description="Cadastre logo, paleta de cores, tipografia e tom de voz. A IA usa esses dados em todas as gerações."
        milestone="M-MKT-01"
      />
    </MktShell>
  );
}
