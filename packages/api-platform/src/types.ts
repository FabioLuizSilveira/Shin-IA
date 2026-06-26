// ─── HTTP Primitives ──────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpStatusCode = number;

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: unknown;
  tenantId: string | null;
  userId: string | null;
}

export interface ApiResponse<T = unknown> {
  status: HttpStatusCode;
  body: T;
  headers?: Record<string, string>;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  pageSize: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
  };
}

// ─── Filtering & Sorting ──────────────────────────────────────────────────────

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

export interface FilterParam {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: string | string[] | number;
}

export interface ListParams {
  pagination: PaginationParams;
  sort?: SortParams;
  filters?: FilterParam[];
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// ─── OpenAPI Schema Primitives ────────────────────────────────────────────────

export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null";

export interface JsonSchema {
  type?: JsonSchemaType | JsonSchemaType[];
  format?: string;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  example?: unknown;
  $ref?: string;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  description?: string;
  schema: JsonSchema;
}

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: JsonSchema }>;
  };
  responses: Record<
    string,
    { description: string; content?: Record<string, { schema: JsonSchema }> }
  >;
  security?: Array<Record<string, string[]>>;
}

export interface OpenApiPath {
  [method: string]: OpenApiOperation;
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, OpenApiPath>;
  components: {
    schemas: Record<string, JsonSchema>;
    securitySchemes?: Record<string, unknown>;
  };
  tags: Array<{ name: string; description?: string }>;
}

// ─── Middleware Types ─────────────────────────────────────────────────────────

export interface TenantContext {
  tenantId: string;
  branchIds: string[];
  capabilities: string[];
}

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  platformRole: string | null;
  tenantRole: string | null;
  mfaVerified: boolean;
  isImpersonating: boolean;
}

export interface AuditEntry {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  method: HttpMethod;
  path: string;
  statusCode: HttpStatusCode;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
  duration: number;
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: ApiRequest) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}
