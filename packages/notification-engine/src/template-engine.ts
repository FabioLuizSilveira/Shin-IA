import type { NotificationTemplate } from "./types.js";

export interface RenderResult {
  subject: string | null;
  body: string;
}

/**
 * Renders a notification template by replacing {{variable}} placeholders with
 * values from the provided context. No external templating dependency needed.
 */
export class TemplateEngine {
  render(template: NotificationTemplate, context: Record<string, unknown>): RenderResult {
    return {
      subject: template.subject ? this.interpolate(template.subject, context) : null,
      body: this.interpolate(template.body, context),
    };
  }

  interpolate(text: string, context: Record<string, unknown>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = context[key];
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }

  extractVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }
}
