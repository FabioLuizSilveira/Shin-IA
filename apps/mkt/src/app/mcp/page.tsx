import { MktShell } from "@/components/layout/mkt-shell";
import { MKT_MCP_TOOLS } from "@shina/marketing-ai";
import { Bot, Lock, Eye } from "lucide-react";

export default function McpPage() {
  return (
    <MktShell title="MCP Server">
      <div className="max-w-3xl">
        <div className="card-glass rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-mkt-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-mkt-glow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Ads MCP Server
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Conecte Claude, Cursor, n8n e outros agentes para operar suas campanhas por
                linguagem natural. Toda ação mutante cria um rascunho que exige aprovação humana —
                nada é publicado automaticamente.
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Tools disponíveis ({MKT_MCP_TOOLS.length})
        </h3>
        <div className="space-y-2">
          {MKT_MCP_TOOLS.map((tool) => (
            <div key={tool.name} className="card-glass rounded-xl p-4 flex items-start gap-3">
              {tool.mutating ? (
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <code className="text-sm font-semibold text-slate-900 dark:text-white">
                  {tool.name}
                </code>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {tool.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="card-glass rounded-2xl p-5 mt-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Como conectar</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Endpoint MCP (Streamable HTTP) com autenticação por bearer token:
          </p>
          <pre className="text-xs text-slate-300 bg-black/30 rounded-xl p-3 overflow-x-auto">
            {`URL:   https://mkt.shinaia.com.br/api/mcp
Auth:  Authorization: Bearer <seu access token Supabase>

Exemplo (Claude Desktop / claude_desktop_config.json):
{
  "mcpServers": {
    "shina-marketing": {
      "url": "https://mkt.shinaia.com.br/api/mcp",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}`}
          </pre>
          <p className="text-xs text-slate-500 mt-3">
            Tools com <Lock className="w-3 h-3 inline" /> criam rascunhos que exigem aprovação
            humana; tools com <Eye className="w-3 h-3 inline" /> são somente leitura.
          </p>
        </div>
      </div>
    </MktShell>
  );
}
