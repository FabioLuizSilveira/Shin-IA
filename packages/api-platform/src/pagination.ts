import type {
  PaginationParams,
  PaginatedResponse,
  SortParams,
  FilterParam,
  ListParams,
} from "./types.js";

export function parsePaginationParams(query: Record<string, string | string[]>): PaginationParams {
  const page = Math.max(1, parseInt(String(query["page"] ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(query["pageSize"] ?? "20"), 10) || 20),
  );
  const cursor = typeof query["cursor"] === "string" ? query["cursor"] : undefined;
  return { page, pageSize, cursor };
}

export function parseSortParams(query: Record<string, string | string[]>): SortParams | undefined {
  const sortBy = typeof query["sortBy"] === "string" ? query["sortBy"] : undefined;
  if (!sortBy) return undefined;
  const direction = query["sortDir"] === "desc" ? "desc" : "asc";
  return { field: sortBy, direction };
}

export function parseFilterParams(query: Record<string, string | string[]>): FilterParam[] {
  const filters: FilterParam[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("filter.")) continue;
    const [, field, op] = key.split(".");
    if (!field || !op) continue;
    const operator = op as FilterParam["operator"];
    const rawValue = Array.isArray(value) ? value : String(value);
    filters.push({ field, operator, value: rawValue });
  }
  return filters;
}

export function parseListParams(query: Record<string, string | string[]>): ListParams {
  return {
    pagination: parsePaginationParams(query),
    sort: parseSortParams(query),
    filters: parseFilterParams(query),
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
  nextCursor?: string,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.pageSize);
  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
      nextCursor,
    },
  };
}

export function applyPagination<T>(items: T[], params: PaginationParams): T[] {
  const start = (params.page - 1) * params.pageSize;
  return items.slice(start, start + params.pageSize);
}
