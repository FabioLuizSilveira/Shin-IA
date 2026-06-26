export interface DomainEvent<P extends Record<string, unknown> = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly tenantId: string | null;
  readonly version: number;
  readonly payload: P;
}
