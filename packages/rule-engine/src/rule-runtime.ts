import type {
  Rule,
  RuleContext,
  RuleEvaluationResult,
  RuleRuntimeResult,
  BlockAction,
  RuleRepository,
} from "./types.js";
import { ConditionEvaluator } from "./condition-evaluator.js";

export interface RuleRuntimeDeps {
  ruleRepository: RuleRepository;
}

export interface ActionExecutor {
  execute(rule: Rule, context: RuleContext): Promise<void>;
}

export class RuleRuntime {
  private repo: RuleRepository;
  private evaluator: ConditionEvaluator;
  private actionExecutors: Map<string, ActionExecutor>;

  constructor(deps: RuleRuntimeDeps) {
    this.repo = deps.ruleRepository;
    this.evaluator = new ConditionEvaluator();
    this.actionExecutors = new Map();
  }

  registerActionExecutor(actionType: string, executor: ActionExecutor): void {
    this.actionExecutors.set(actionType, executor);
  }

  async evaluate(context: RuleContext): Promise<RuleRuntimeResult> {
    const [tenantRules, platformRules] = await Promise.all([
      this.repo.findByTrigger(context.tenantId, context.eventType),
      this.repo.findPlatformRules(context.eventType),
    ]);

    // Platform rules execute first (usually higher priority/lower number)
    const allRules = [...platformRules, ...tenantRules]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    const results: RuleEvaluationResult[] = [];
    let blockedBy: BlockAction | null = null;

    for (const rule of allRules) {
      const result = await this.evaluateRule(rule, context);
      results.push(result);

      // Check for block actions — stop execution chain
      if (result.matched) {
        const blockAction = rule.actions.find((a): a is BlockAction => a.type === "block");
        if (blockAction) {
          blockedBy = blockAction;
          break;
        }
      }
    }

    return {
      eventType: context.eventType,
      tenantId: context.tenantId,
      totalRulesEvaluated: results.length,
      matchedRules: results.filter((r) => r.matched).length,
      results,
      blockedBy,
    };
  }

  async evaluateRule(rule: Rule, context: RuleContext): Promise<RuleEvaluationResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];

    let matched = false;
    try {
      matched = this.evaluator.evaluate(rule.condition, context.data);
    } catch (err) {
      errors.push(`Condition evaluation error: ${String(err)}`);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        actionsExecuted: [],
        errors,
        evaluatedAt: now,
      };
    }

    if (!matched) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        actionsExecuted: [],
        errors,
        evaluatedAt: now,
      };
    }

    const actionsExecuted = [];
    for (const action of rule.actions) {
      if (action.type === "block") {
        actionsExecuted.push(action);
        continue; // block is handled by the caller
      }
      try {
        const executor = this.actionExecutors.get(action.type);
        if (executor) {
          await executor.execute(rule, context);
        }
        actionsExecuted.push(action);
      } catch (err) {
        errors.push(`Action '${action.type}' failed: ${String(err)}`);
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: true,
      actionsExecuted,
      errors,
      evaluatedAt: now,
    };
  }

  isBlocked(result: RuleRuntimeResult): boolean {
    return result.blockedBy !== null;
  }
}
