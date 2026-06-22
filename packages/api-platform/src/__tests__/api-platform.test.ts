import { describe, it, expect, beforeEach } from "vitest";
import {
  ok,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  internalError,
  errorToResponse,
  validateRequired,
  validatePagination,
  buildAuditEntry,
  InMemoryRateLimiter,
  extractTenantContext,
  extractAuthContext,
  isApiError,
} from "../middleware.js";
import {
  parsePaginationParams,
  parseSortParams,
  parseFilterParams,
  buildPaginatedResponse,
  applyPagination,
} from "../pagination.js";
import { OpenApiBuilder, CommonSchemas } from "../openapi.js";
import type { ApiRequest } from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeRequest = (overrides: Partial<ApiRequest> = {}): ApiRequest => ({
  method: "GET",
  path: "/api/v1/operations",
  params: {},
  query: {},
  headers: {},
  body: null,
  tenantId: "tenant-1",
  userId: "user-1",
  ...overrides,
});

// ─── Response helpers ─────────────────────────────────────────────────────────

describe("Response helpers", () => {
  it("ok returns 200", () => {
    const res = ok({ id: "1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "1" });
  });

  it("created returns 201", () => {
    expect(created({ id: "1" }).status).toBe(201);
  });

  it("noContent returns 204", () => {
    expect(noContent().status).toBe(204);
  });

  it("badRequest returns 400 with code", () => {
    const res = badRequest("Invalid input", "VALIDATION_ERROR");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("unauthorized returns 401", () => {
    expect(unauthorized().status).toBe(401);
    expect(unauthorized("Custom").body.error.message).toBe("Custom");
  });

  it("forbidden returns 403", () => {
    expect(forbidden().status).toBe(403);
  });

  it("notFound returns 404 with resource name", () => {
    const res = notFound("Operation", "op-1");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain("op-1");
  });

  it("notFound without id returns generic message", () => {
    expect(notFound("Operation").body.error.message).toContain("not found");
  });

  it("conflict returns 409", () => {
    const res = conflict("Already exists");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("tooManyRequests returns 429 with Retry-After", () => {
    const res = tooManyRequests(5000);
    expect(res.status).toBe(429);
    expect(res.headers?.["Retry-After"]).toBe("5");
  });

  it("internalError returns 500", () => {
    const res = internalError("trace-123");
    expect(res.status).toBe(500);
    expect(res.body.error.traceId).toBe("trace-123");
  });
});

// ─── Error mapping ────────────────────────────────────────────────────────────

describe("errorToResponse", () => {
  it("maps 'not found' errors to 404", () => {
    expect(errorToResponse(new Error("operation not found")).status).toBe(404);
  });

  it("maps 'unauthorized' errors to 401", () => {
    expect(errorToResponse(new Error("unauthorized access")).status).toBe(401);
  });

  it("maps 'forbidden' errors to 403", () => {
    expect(errorToResponse(new Error("not allowed")).status).toBe(403);
  });

  it("maps 'blocked by rule' errors to 400", () => {
    expect(errorToResponse(new Error("blocked by rule: expired")).status).toBe(400);
  });

  it("maps 'already' errors to 409", () => {
    expect(errorToResponse(new Error("already exists")).status).toBe(409);
  });

  it("maps unknown errors to 500", () => {
    expect(errorToResponse(new Error("weird problem")).status).toBe(500);
    expect(errorToResponse("string error").status).toBe(500);
  });

  it("isApiError returns true for valid error objects", () => {
    expect(isApiError({ code: "X", message: "y" })).toBe(true);
    expect(isApiError({ code: "X" })).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("validateRequired", () => {
  it("returns empty array when all fields present", () => {
    expect(validateRequired({ name: "x", type: "y" }, ["name", "type"])).toHaveLength(0);
  });

  it("returns errors for missing fields", () => {
    const errors = validateRequired({ name: "x" }, ["name", "type"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe("type");
  });

  it("catches empty string as missing", () => {
    const errors = validateRequired({ name: "" }, ["name"]);
    expect(errors).toHaveLength(1);
  });
});

describe("validatePagination", () => {
  it("returns parsed values for valid params", () => {
    const result = validatePagination({ page: "2", pageSize: "10" });
    expect(Array.isArray(result)).toBe(false);
    if (!Array.isArray(result)) {
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    }
  });

  it("returns errors for invalid page", () => {
    const result = validatePagination({ page: "0", pageSize: "10" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns errors for pageSize > 100", () => {
    const result = validatePagination({ page: "1", pageSize: "200" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe("buildAuditEntry", () => {
  it("builds audit entry from request and response", () => {
    const req = makeRequest({ path: "/api/v1/operations/op-1", params: { id: "op-1" } });
    const res = ok({ id: "op-1" });
    const entry = buildAuditEntry(req, res, Date.now() - 50);

    expect(entry.tenantId).toBe("tenant-1");
    expect(entry.userId).toBe("user-1");
    expect(entry.method).toBe("GET");
    expect(entry.statusCode).toBe(200);
    expect(entry.duration).toBeGreaterThanOrEqual(0);
    expect(entry.resourceId).toBe("op-1");
  });

  it("extracts IP from x-forwarded-for header", () => {
    const req = makeRequest({ headers: { "x-forwarded-for": "192.168.1.1" } });
    const entry = buildAuditEntry(req, ok(null), Date.now());
    expect(entry.ipAddress).toBe("192.168.1.1");
  });
});

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;
  const req = makeRequest();

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 3 });
  });

  it("allows requests within limit", () => {
    expect(limiter.check(req).allowed).toBe(true);
    expect(limiter.check(req).allowed).toBe(true);
    expect(limiter.check(req).allowed).toBe(true);
  });

  it("blocks requests exceeding limit", () => {
    limiter.check(req);
    limiter.check(req);
    limiter.check(req);
    const result = limiter.check(req);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.remaining).toBe(0);
  });

  it("uses custom key generator", () => {
    const customLimiter = new InMemoryRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      keyGenerator: (r) => r.tenantId ?? "anon",
    });
    expect(customLimiter.check(req).allowed).toBe(true);
    expect(customLimiter.check(req).allowed).toBe(true);
    expect(customLimiter.check(req).allowed).toBe(false);
  });

  it("reset clears the window", () => {
    limiter.check(req);
    limiter.check(req);
    limiter.check(req);
    limiter.reset("user-1");
    expect(limiter.check(req).allowed).toBe(true);
  });

  it("uses anonymous key when no user or tenant", () => {
    const anonReq = makeRequest({ userId: null, tenantId: null });
    expect(limiter.check(anonReq).allowed).toBe(true);
  });
});

// ─── Middleware extractors ────────────────────────────────────────────────────

describe("extractTenantContext", () => {
  it("extracts tenant context from request", () => {
    const req = makeRequest({
      tenantId: "tenant-1",
      headers: { "x-branch-ids": "b1,b2", "x-capabilities": "cap1,cap2" },
    });
    const ctx = extractTenantContext(req);
    expect(ctx?.tenantId).toBe("tenant-1");
    expect(ctx?.branchIds).toEqual(["b1", "b2"]);
    expect(ctx?.capabilities).toEqual(["cap1", "cap2"]);
  });

  it("falls back to header when tenantId is null", () => {
    const req = makeRequest({ tenantId: null, headers: { "x-tenant-id": "tenant-from-header" } });
    expect(extractTenantContext(req)?.tenantId).toBe("tenant-from-header");
  });

  it("returns null when no tenant found", () => {
    const req = makeRequest({ tenantId: null });
    expect(extractTenantContext(req)).toBeNull();
  });
});

describe("extractAuthContext", () => {
  it("extracts auth context from request", () => {
    const req = makeRequest({
      headers: {
        "x-platform-role": "platform_admin",
        "x-tenant-role": "tenant_manager",
        "x-mfa-verified": "true",
        "x-is-impersonating": "false",
      },
    });
    const ctx = extractAuthContext(req);
    expect(ctx?.userId).toBe("user-1");
    expect(ctx?.platformRole).toBe("platform_admin");
    expect(ctx?.mfaVerified).toBe(true);
    expect(ctx?.isImpersonating).toBe(false);
  });

  it("returns null when no userId", () => {
    const req = makeRequest({ userId: null });
    expect(extractAuthContext(req)).toBeNull();
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe("Pagination", () => {
  describe("parsePaginationParams", () => {
    it("parses page and pageSize", () => {
      const p = parsePaginationParams({ page: "2", pageSize: "15" });
      expect(p.page).toBe(2);
      expect(p.pageSize).toBe(15);
    });

    it("defaults to page 1 and pageSize 20", () => {
      const p = parsePaginationParams({});
      expect(p.page).toBe(1);
      expect(p.pageSize).toBe(20);
    });

    it("clamps pageSize to max 100", () => {
      expect(parsePaginationParams({ pageSize: "999" }).pageSize).toBe(100);
    });

    it("includes cursor when provided", () => {
      const p = parsePaginationParams({ cursor: "abc123" });
      expect(p.cursor).toBe("abc123");
    });
  });

  describe("parseSortParams", () => {
    it("returns sort params when sortBy provided", () => {
      const s = parseSortParams({ sortBy: "createdAt", sortDir: "desc" });
      expect(s?.field).toBe("createdAt");
      expect(s?.direction).toBe("desc");
    });

    it("defaults direction to asc", () => {
      expect(parseSortParams({ sortBy: "name" })?.direction).toBe("asc");
    });

    it("returns undefined when no sortBy", () => {
      expect(parseSortParams({})).toBeUndefined();
    });
  });

  describe("parseFilterParams", () => {
    it("parses filter.field.operator keys", () => {
      const filters = parseFilterParams({ "filter.status.eq": "active" });
      expect(filters).toHaveLength(1);
      expect(filters[0]?.field).toBe("status");
      expect(filters[0]?.operator).toBe("eq");
      expect(filters[0]?.value).toBe("active");
    });

    it("ignores non-filter keys", () => {
      expect(parseFilterParams({ page: "1", sortBy: "name" })).toHaveLength(0);
    });
  });

  describe("buildPaginatedResponse", () => {
    it("builds response with correct metadata", () => {
      const res = buildPaginatedResponse(["a", "b"], 50, { page: 2, pageSize: 10 });
      expect(res.pagination.total).toBe(50);
      expect(res.pagination.totalPages).toBe(5);
      expect(res.pagination.hasNextPage).toBe(true);
      expect(res.pagination.hasPrevPage).toBe(true);
    });

    it("first page has no prevPage", () => {
      const res = buildPaginatedResponse(["a"], 10, { page: 1, pageSize: 5 });
      expect(res.pagination.hasPrevPage).toBe(false);
    });
  });

  describe("applyPagination", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it("slices items for page 1", () => {
      expect(applyPagination(items, { page: 1, pageSize: 3 })).toEqual([1, 2, 3]);
    });

    it("slices items for page 2", () => {
      expect(applyPagination(items, { page: 2, pageSize: 3 })).toEqual([4, 5, 6]);
    });
  });
});

// ─── OpenAPI Builder ──────────────────────────────────────────────────────────

describe("OpenApiBuilder", () => {
  it("builds a valid OpenAPI document", () => {
    const doc = new OpenApiBuilder({ title: "Shinã API", version: "1.0.0" })
      .addTag("operations", "Operation management")
      .addSchema("Operation", { type: "object", properties: { id: { type: "string" } } })
      .addRoute({
        method: "GET",
        path: "/api/v1/operations",
        operation: {
          operationId: "listOperations",
          summary: "List operations",
          tags: ["operations"],
          responses: { "200": { description: "Success" } },
        },
      })
      .addRoute({
        method: "POST",
        path: "/api/v1/operations",
        operation: {
          operationId: "createOperation",
          summary: "Create operation",
          tags: ["operations"],
          responses: { "201": { description: "Created" } },
        },
      })
      .build();

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Shinã API");
    expect(doc.tags).toHaveLength(1);
    expect(doc.components.schemas["Operation"]).toBeDefined();
    expect(doc.paths["/api/v1/operations"]).toBeDefined();
    expect(doc.paths["/api/v1/operations"]?.["get"]).toBeDefined();
    expect(doc.paths["/api/v1/operations"]?.["post"]).toBeDefined();
  });

  it("converts :param to {param} in path", () => {
    const doc = new OpenApiBuilder({ title: "Test", version: "1.0.0" })
      .addRoute({
        method: "GET",
        path: "/api/v1/operations/:id",
        operation: {
          operationId: "getOperation",
          summary: "Get",
          tags: [],
          responses: { "200": { description: "ok" } },
        },
      })
      .build();

    expect(doc.paths["/api/v1/operations/{id}"]).toBeDefined();
  });

  it("addSecurityScheme adds to components", () => {
    const doc = new OpenApiBuilder({ title: "Test", version: "1.0.0" })
      .addSecurityScheme("bearerAuth", { type: "http", scheme: "bearer" })
      .build();

    expect(doc.components.securitySchemes?.["bearerAuth"]).toBeDefined();
  });

  it("CommonSchemas are valid objects", () => {
    expect(CommonSchemas.ErrorResponse.type).toBe("object");
    expect(CommonSchemas.PaginationQuery.type).toBe("object");
    expect(CommonSchemas.PaginatedMeta.type).toBe("object");
  });
});
