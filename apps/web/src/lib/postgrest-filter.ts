// Security fix: values interpolated into a PostgREST `.ilike()`/`.filter()`
// value are not covered by the query builder's normal parameter binding —
// `,`, `(`, `)` and `.` are structural metacharacters in PostgREST's filter
// mini-language (they separate conditions / delimit column.operator.value).
// A raw search term containing them can inject additional conditions or
// malform the filter. Strips those characters rather than escaping them —
// there's no escape sequence in this filter syntax, and losing a literal
// comma/paren from a free-text search term is an acceptable tradeoff for
// not building a filter parser. Mirrors apps/mkt's tested equivalent.
export function sanitizePostgrestFilterValue(value: string): string {
  return value.replace(/[,().]/g, "");
}
