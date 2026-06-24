import type {
  ApiRequest,
  ApiResponse,
  ApiError,
  ApiErrorResponse,
  AuditEntry,
  RateLimitConfig,
  RateLimitResult,
  TenantContext,
  AuthContext,
} from "./types.js";

// ─── Response helpers ─────────────────────────────────────────────────────────

export function ok<T>(body: T): ApiResponse<T> {
  return { status: 200, body };
}

export function created<T>(body: T): ApiResponse<T> {
  return { status: 201, body };
}

export function noContent(): ApiResponse<null> {
  return { status: 204, body: null };
}

export function badRequest(
  message: string,
  code = "BAD_REQUEST",
  details?: Record<string, unknown>,
): ApiResponse<ApiErrorResponse> {
  return { status: 400, body: { error: { code, message, details } } };
}

export function unauthorized(message = "Unauthorized"): ApiResponse<ApiErrorResponse> {
  return { status: 401, body: { error: { code: "UNAUTHORIZED", message } } };
}

export function forbidden(message = "Forbidden"): ApiResponse<ApiErrorResponse> {
  return { status: 403, body: { error: { code: "FORBIDDEN", message } } };
}

export function notFound(resource: string, id?: string): ApiResponse<ApiErrorResponse> {
  const message = id ? `${resource} '${id}' not found` : `${resource} not found`;
  return { status: 404, body: { error: { code: "NOT_FOUND", message } } };
}

export function conflict(message: string): ApiResponse<ApiErrorResponse> {
  return { status: 409, body: { error: { code: "CONFLICT", message } } };
}

export function tooManyRequests(retryAfterMs: number): ApiResponse<ApiErrorResponse> {
  return {
    status: 429,
    body: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
    headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
  };
}

export function internalError(traceId?: string): ApiResponse<ApiErrorResponse> {
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Internal server error", traceId } },
  };
}

// ─── Error mapping ────────────────────────────────────────────────────────────

export function errorToResponse(err: unknown, traceId?: string): ApiResponse<ApiErrorResponse> {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("not found")) return notFound("Resource");
    if (msg.includes("unauthorized")) return unauthorized(err.message);
    if (msg.includes("forbidden") || msg.includes("not allowed")) return forbidden(err.message);
    if (msg.includes("blocked by rule")) return badRequest(err.message, "RULE_BLOCKED");
    if (msg.includes("already") || msg.includes("conflict")) return conflict(err.message);
  }
  return internalError(traceId);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateRequired(
  body: Record<string, unknown>,
  fields: string[],
): ValidationError[] {
  return fields
    .filter((f) => body[f] === undefined || body[f] === null || body[f] === "")
    .map((f) => ({ field: f, message: `${f} is required` }));
}

export function validatePagination(
  query: Record<string, string | string[]>,
): { page: number; pageSize: number } | ValidationError[] {
  const page = parseInt(String(query["page"] ?? "1"), 10);
  const pageSize = parseInt(String(query["pageSize"] ?? "20"), 10);

  const errors: ValidationError[] = [];
  if (isNaN(page) || page < 1)
    errors.push({ field: "page", message: "page must be a positive integer" });
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100)
    errors.push({ field: "pageSize", message: "pageSize must be between 1 and 100" });

  if (errors.length > 0) return errors;
  return { page, pageSize };
}

// ─── Audit middleware ─────────────────────────────────────────────────────────

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}

export function buildAuditEntry(
  req: ApiRequest,
  response: ApiResponse,
  startTime: number,
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    tenantId: req.tenantId,
    userId: req.userId,
    action: `${req.method} ${req.path}`,
    resource: req.path.split("/")[2] ?? "unknown",
    resourceId: req.params["id"] ?? null,
    method: req.method,
    path: req.path,
    statusCode: response.status,
    ipAddress: req.headers["x-forwarded-for"] ?? req.headers["x-real-ip"] ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    occurredAt: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

export class InMemoryRateLimiter {
  private windows: Map<string, { count: number; resetAt: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(req: ApiRequest): RateLimitResult {
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(req)
      : (req.userId ?? req.tenantId ?? req.headers["x-forwarded-for"] ?? "anonymous");

    const now = Date.now();
    let window = this.windows.get(key);

    if (!window || now > window.resetAt) {
      window = { count: 0, resetAt: now + this.config.windowMs };
      this.windows.set(key, window);
    }

    window.count++;

    const remaining = Math.max(0, this.config.maxRequests - window.count);
    const allowed = window.count <= this.config.maxRequests;
    const resetAt = new Date(window.resetAt);

    return {
      allowed,
      remaining,
      resetAt,
      retryAfterMs: allowed ? undefined : window.resetAt - now,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}

// ─── Tenant middleware ────────────────────────────────────────────────────────

export function extractTenantContext(req: ApiRequest): TenantContext | null {
  const tenantId = req.tenantId ?? req.headers["x-tenant-id"] ?? null;
  if (!tenantId) return null;

  const branchIds = req.headers["x-branch-ids"]
    ? req.headers["x-branch-ids"].split(",").map((s) => s.trim())
    : [];

  const capabilities = req.headers["x-capabilities"]
    ? req.headers["x-capabilities"].split(",").map((s) => s.trim())
    : [];

  return { tenantId, branchIds, capabilities };
}

export function extractAuthContext(req: ApiRequest): AuthContext | null {
  const userId = req.userId ?? req.headers["x-user-id"] ?? null;
  if (!userId) return null;

  return {
    userId,
    tenantId: req.tenantId,
    platformRole: req.headers["x-platform-role"] ?? null,
    tenantRole: req.headers["x-tenant-role"] ?? null,
    mfaVerified: req.headers["x-mfa-verified"] === "true",
    isImpersonating: req.headers["x-is-impersonating"] === "true",
  };
}

// ─── Error guard ──────────────────────────────────────────────────────────────

export function isApiError(err: unknown): err is ApiError {
  return typeof err === "object" && err !== null && "code" in err && "message" in err;
}
