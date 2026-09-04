import type { AgentTool } from "../tool-types";
import { HELP_CONTENT, lookupHelp } from "../help-content";

// No requiredPermission on any of these three — help must always be
// visible regardless of the user's role/permissions, per the product
// spec's HELP tool list. Still gated by a feature flag like every other
// tool (agent.tools.help), so a tenant not yet on the pilot sees none of
// this either.
export const getProductHelpTool: AgentTool<{ topic: string }> = {
  name: "get_product_help",
  description:
    "Explica um módulo ou conceito da plataforma Shinã (ex: 'contracts', 'maintenance').",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Slug do módulo/conceito",
        enum: Object.keys(HELP_CONTENT),
      },
    },
    required: ["topic"],
  },
  requiredFeature: "agent.tools.help",
  async execute(args) {
    return { ok: true, data: lookupHelp(args.topic) };
  },
};

export const getScreenHelpTool: AgentTool<Record<string, never>> = {
  name: "get_screen_help",
  description: "Explica a tela em que o usuário está agora, sem precisar dizer qual é.",
  inputSchema: { type: "object", properties: {} },
  requiredFeature: "agent.tools.help",
  async execute(_args, ctx) {
    // currentModule comes exclusively from AgentContext (server-resolved
    // from the request's own route context) — never a model-supplied arg.
    return { ok: true, data: lookupHelp(ctx.currentModule) };
  },
};

export const getFeatureExplanationTool: AgentTool<{ feature: string }> = {
  name: "get_feature_explanation",
  description: "Explica uma funcionalidade específica da plataforma (ex: 'contracts.signature').",
  inputSchema: {
    type: "object",
    properties: {
      feature: {
        type: "string",
        description: "Slug da funcionalidade",
        enum: Object.keys(HELP_CONTENT),
      },
    },
    required: ["feature"],
  },
  requiredFeature: "agent.tools.help",
  async execute(args) {
    return { ok: true, data: lookupHelp(args.feature) };
  },
};
