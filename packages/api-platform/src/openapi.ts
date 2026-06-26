import type { OpenApiDocument, JsonSchema, OpenApiOperation } from "./types.js";

export interface RouteSpec {
  method: string;
  path: string;
  operation: OpenApiOperation;
}

export class OpenApiBuilder {
  private doc: OpenApiDocument;

  constructor(info: OpenApiDocument["info"], serverUrl = "http://localhost:3000") {
    this.doc = {
      openapi: "3.1.0",
      info,
      servers: [{ url: serverUrl }],
      paths: {},
      components: { schemas: {}, securitySchemes: {} },
      tags: [],
    };
  }

  addTag(name: string, description?: string): this {
    this.doc.tags.push({ name, description });
    return this;
  }

  addSchema(name: string, schema: JsonSchema): this {
    this.doc.components.schemas[name] = schema;
    return this;
  }

  addRoute(spec: RouteSpec): this {
    const path = this.normalizePath(spec.path);
    if (!this.doc.paths[path]) this.doc.paths[path] = {};
    this.doc.paths[path]![spec.method.toLowerCase()] = spec.operation;
    return this;
  }

  addSecurityScheme(name: string, scheme: unknown): this {
    this.doc.components.securitySchemes = this.doc.components.securitySchemes ?? {};
    this.doc.components.securitySchemes[name] = scheme;
    return this;
  }

  build(): OpenApiDocument {
    return structuredClone(this.doc);
  }

  // Convert :param notation to {param} OpenAPI notation
  private normalizePath(path: string): string {
    return path.replace(/:([^/]+)/g, "{$1}");
  }
}

// ─── Common schemas used across API ──────────────────────────────────────────

export const CommonSchemas = {
  PaginationQuery: {
    type: "object" as const,
    properties: {
      page: { type: "integer" as const, minimum: 1, description: "Page number (1-indexed)" },
      pageSize: {
        type: "integer" as const,
        minimum: 1,
        maximum: 100,
        description: "Items per page",
      },
      cursor: { type: "string" as const, description: "Cursor for cursor-based pagination" },
    },
  },

  ErrorResponse: {
    type: "object" as const,
    required: ["error"],
    properties: {
      error: {
        type: "object" as const,
        required: ["code", "message"],
        properties: {
          code: { type: "string" as const },
          message: { type: "string" as const },
          traceId: { type: "string" as const },
          details: { type: "object" as const },
        },
      },
    },
  },

  PaginatedMeta: {
    type: "object" as const,
    required: ["page", "pageSize", "total", "totalPages", "hasNextPage", "hasPrevPage"],
    properties: {
      page: { type: "integer" as const },
      pageSize: { type: "integer" as const },
      total: { type: "integer" as const },
      totalPages: { type: "integer" as const },
      hasNextPage: { type: "boolean" as const },
      hasPrevPage: { type: "boolean" as const },
      nextCursor: { type: "string" as const, nullable: true },
    },
  },
};
