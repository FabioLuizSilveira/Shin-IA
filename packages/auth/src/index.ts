// @shina/auth - Authentication package
// Provides authentication services, session management, and MFA
// Does NOT implement authorization (RBAC/ABAC) - that comes in M5

export * from "./types.js";
export * from "./events/index.js";
export { AuthService } from "./auth-service.js";
export type { AuthServiceDeps } from "./auth-service.js";
export { SessionService } from "./session-service.js";
export type { SessionServiceDeps } from "./session-service.js";
export { MFAService } from "./mfa-service.js";
export type { MFAServiceDeps } from "./mfa-service.js";
export { TenantContextResolver } from "./tenant-context.js";
