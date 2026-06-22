import type { MobileBranding } from "./types.js";
import { MobileRuntimeError } from "./offline-sync.js";

const DEFAULT_BRANDING: Omit<MobileBranding, "tenantId" | "appName"> = {
  primaryColor: "#1a73e8",
  secondaryColor: "#fbbc04",
  fontFamily: "System",
  splashColor: "#ffffff",
};

export class MobileBrandingRuntime {
  private readonly store = new Map<string, MobileBranding>();

  register(branding: MobileBranding): void {
    this.store.set(branding.tenantId, { ...branding });
  }

  resolveBranding(tenantId: string): MobileBranding {
    const stored = this.store.get(tenantId);
    if (!stored) {
      throw new MobileRuntimeError(
        `No branding found for tenant: ${tenantId}`,
        "BRANDING_NOT_FOUND",
      );
    }
    return { ...DEFAULT_BRANDING, ...stored };
  }

  isCustomBranded(tenantId: string): boolean {
    return this.store.has(tenantId);
  }

  mergeBranding(tenantId: string, overrides: Partial<MobileBranding>): MobileBranding {
    const base = this.resolveBranding(tenantId);
    return { ...base, ...overrides, tenantId };
  }

  unregister(tenantId: string): void {
    if (!this.store.has(tenantId)) {
      throw new MobileRuntimeError(
        `No branding found for tenant: ${tenantId}`,
        "BRANDING_NOT_FOUND",
      );
    }
    this.store.delete(tenantId);
  }

  listAll(): MobileBranding[] {
    return [...this.store.values()];
  }

  computeCssTokens(tenantId: string): Record<string, string> {
    const branding = this.resolveBranding(tenantId);
    const tokens: Record<string, string> = {
      "--primary": branding.primaryColor,
      "--secondary": branding.secondaryColor,
      "--app-name": branding.appName,
    };
    if (branding.fontFamily) tokens["--font"] = branding.fontFamily;
    if (branding.splashColor) tokens["--splash"] = branding.splashColor;
    if (branding.logoUrl) tokens["--logo"] = branding.logoUrl;
    return tokens;
  }
}
