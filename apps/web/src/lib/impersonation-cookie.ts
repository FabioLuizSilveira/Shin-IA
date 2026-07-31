// Split from lib/impersonation.ts so middleware (edge runtime) can check
// for the cookie's presence without importing the admin client / next/headers.
export const IMPERSONATION_COOKIE = "shina_impersonation_id";
