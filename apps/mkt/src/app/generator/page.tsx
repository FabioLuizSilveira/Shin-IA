import { MktShell } from "@/components/layout/mkt-shell";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { Wand2 } from "lucide-react";

export default function GeneratorPage() {
  return (
    <MktShell title="Gerador IA">
      <ModulePlaceholder
        icon={Wand2}
        title="Gerador de Anúncios IA"
        description="Gere anúncios estáticos a partir do seu Brand Kit, com variações automáticas e exportação por plataforma."
        milestone="M-MKT-03"
      />
    </MktShell>
  );
}
