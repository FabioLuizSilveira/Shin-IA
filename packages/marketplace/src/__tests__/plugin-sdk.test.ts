import { describe, it, expect, beforeEach } from "vitest";
import { PluginSDK } from "../plugin-sdk.js";
import { MarketplaceError } from "../partner-registry.js";
import type { Plugin } from "../types.js";

function makePlugin(id = "pl1", partnerId = "p1"): Plugin {
  return {
    id,
    name: "GPS Tracker",
    version: "1.0.0",
    partnerId,
    description: "Real-time GPS tracking plugin",
    status: "draft",
    capabilities: ["gps", "tracking"],
  };
}

describe("PluginSDK", () => {
  let sdk: PluginSDK;

  beforeEach(() => {
    sdk = new PluginSDK();
  });

  describe("publish", () => {
    it("publishes plugin and sets status to submitted", () => {
      sdk.publish(makePlugin());
      expect(sdk.get("pl1").status).toBe("submitted");
    });

    it("throws DUPLICATE_PLUGIN for same id", () => {
      sdk.publish(makePlugin());
      expect(() => sdk.publish(makePlugin())).toThrow(MarketplaceError);
    });
  });

  describe("get", () => {
    it("retrieves plugin by id", () => {
      sdk.publish(makePlugin());
      expect(sdk.get("pl1").name).toBe("GPS Tracker");
    });

    it("throws PLUGIN_NOT_FOUND for unknown id", () => {
      expect(() => sdk.get("missing")).toThrow(MarketplaceError);
    });
  });

  describe("approve", () => {
    it("approves a submitted plugin", () => {
      sdk.publish(makePlugin());
      sdk.approve("pl1");
      expect(sdk.get("pl1").status).toBe("approved");
    });

    it("sets publishedAt on approval", () => {
      sdk.publish(makePlugin());
      sdk.approve("pl1");
      expect(sdk.get("pl1").publishedAt).toBeTruthy();
    });

    it("throws PLUGIN_NOT_FOUND for unknown id", () => {
      expect(() => sdk.approve("missing")).toThrow(MarketplaceError);
    });

    it("throws INVALID_PLUGIN_STATE for non-submitted plugin", () => {
      sdk.publish(makePlugin());
      sdk.approve("pl1");
      expect(() => sdk.approve("pl1")).toThrow(MarketplaceError);
    });
  });

  describe("reject", () => {
    it("rejects a submitted plugin", () => {
      sdk.publish(makePlugin());
      sdk.reject("pl1");
      expect(sdk.get("pl1").status).toBe("rejected");
    });

    it("throws INVALID_PLUGIN_STATE for non-submitted plugin", () => {
      sdk.publish(makePlugin("pl1"));
      sdk.approve("pl1");
      expect(() => sdk.reject("pl1")).toThrow(MarketplaceError);
    });

    it("throws PLUGIN_NOT_FOUND for unknown id", () => {
      expect(() => sdk.reject("missing")).toThrow(MarketplaceError);
    });
  });

  describe("deprecate", () => {
    it("deprecates an approved plugin", () => {
      sdk.publish(makePlugin());
      sdk.approve("pl1");
      sdk.deprecate("pl1");
      expect(sdk.get("pl1").status).toBe("deprecated");
    });

    it("sets deprecatedAt on deprecation", () => {
      sdk.publish(makePlugin());
      sdk.approve("pl1");
      sdk.deprecate("pl1");
      expect(sdk.get("pl1").deprecatedAt).toBeTruthy();
    });

    it("throws INVALID_PLUGIN_STATE for non-approved plugin", () => {
      sdk.publish(makePlugin());
      expect(() => sdk.deprecate("pl1")).toThrow(MarketplaceError);
    });

    it("throws PLUGIN_NOT_FOUND for unknown id", () => {
      expect(() => sdk.deprecate("missing")).toThrow(MarketplaceError);
    });
  });

  describe("listByStatus", () => {
    it("filters by status", () => {
      sdk.publish(makePlugin("pl1"));
      sdk.publish(makePlugin("pl2"));
      sdk.approve("pl1");
      expect(sdk.listByStatus("approved")).toHaveLength(1);
      expect(sdk.listByStatus("submitted")).toHaveLength(1);
    });
  });

  describe("listByPartner", () => {
    it("filters by partner", () => {
      sdk.publish(makePlugin("pl1", "p1"));
      sdk.publish(makePlugin("pl2", "p2"));
      expect(sdk.listByPartner("p1")).toHaveLength(1);
    });
  });

  describe("listByCapability", () => {
    it("filters by capability", () => {
      sdk.publish(makePlugin("pl1"));
      sdk.publish({ ...makePlugin("pl2"), capabilities: ["reports"] });
      expect(sdk.listByCapability("gps")).toHaveLength(1);
    });
  });
});
