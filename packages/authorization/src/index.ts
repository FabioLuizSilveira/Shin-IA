// @shina/authorization - Authorization Runtime
// RBAC: Role-based permission evaluation
// ABAC: Attribute-based scope evaluation (branch, capability, blueprint, asset, tenant)
// AuthorizationService: Orchestrates RBAC + ABAC layers

export * from "./types.js";
export { AuthorizationService, type AuthorizationServiceDeps } from "./authorization-service.js";
export * from "./rbac/index.js";
export * from "./abac/index.js";
export * from "./delegated-access/index.js";
export * from "./impersonation/index.js";
