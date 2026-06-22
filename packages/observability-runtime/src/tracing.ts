import type { TraceSpan, SpanStatus } from "./types.js";
import { ObservabilityError } from "./metrics.js";

export class TracingEngine {
  private readonly spans = new Map<string, TraceSpan>();

  startSpan(span: Omit<TraceSpan, "endTime" | "durationMs">): TraceSpan {
    if (this.spans.has(span.id)) {
      throw new ObservabilityError(`Span already exists: ${span.id}`, "DUPLICATE_SPAN");
    }
    const s: TraceSpan = { ...span, status: span.status ?? "unset" };
    this.spans.set(s.id, s);
    return { ...s };
  }

  endSpan(id: string, status: SpanStatus = "ok"): TraceSpan {
    const span = this.spans.get(id);
    if (!span) throw new ObservabilityError(`Span not found: ${id}`, "SPAN_NOT_FOUND");
    if (span.endTime)
      throw new ObservabilityError(`Span already ended: ${id}`, "SPAN_ALREADY_ENDED");
    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(span.startTime).getTime();
    const updated: TraceSpan = { ...span, endTime, status, durationMs };
    this.spans.set(id, updated);
    return { ...updated };
  }

  addEvent(spanId: string, event: string): void {
    const span = this.spans.get(spanId);
    if (!span) throw new ObservabilityError(`Span not found: ${spanId}`, "SPAN_NOT_FOUND");
    const events = [...(span.events ?? []), event];
    this.spans.set(spanId, { ...span, events });
  }

  setTag(spanId: string, key: string, value: string): void {
    const span = this.spans.get(spanId);
    if (!span) throw new ObservabilityError(`Span not found: ${spanId}`, "SPAN_NOT_FOUND");
    this.spans.set(spanId, { ...span, tags: { ...span.tags, [key]: value } });
  }

  getSpan(id: string): TraceSpan {
    const span = this.spans.get(id);
    if (!span) throw new ObservabilityError(`Span not found: ${id}`, "SPAN_NOT_FOUND");
    return { ...span };
  }

  getTrace(traceId: string): TraceSpan[] {
    return [...this.spans.values()].filter((s) => s.traceId === traceId);
  }

  listByStatus(status: SpanStatus): TraceSpan[] {
    return [...this.spans.values()].filter((s) => s.status === status);
  }

  count(): number {
    return this.spans.size;
  }
}
