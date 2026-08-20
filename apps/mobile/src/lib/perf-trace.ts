// PERFORMANCE PASS 2 — temporary instrumentation for the cold-start ->
// useful-dashboard waterfall (docs/mobile/MOBILE_PERFORMANCE_AUDIT_ANDROID.md).
// Off by default (zero cost in normal builds); only active when
// EXPO_PUBLIC_PERF_TRACE=1 is set at build time (see eas.json "preview"
// profile). Never logs a token, PII, or any request/response body — only
// event names and small numeric/status metadata explicitly passed in.
export const PERF_TRACE_ENABLED = process.env.EXPO_PUBLIC_PERF_TRACE === "1";

export function perfMark(event: string, data?: Record<string, string | number | boolean>) {
  if (!PERF_TRACE_ENABLED) return;
  // eslint-disable-next-line no-console
  console.log(`[PERF] ${event}${data ? " " + JSON.stringify(data) : ""}`);
}
