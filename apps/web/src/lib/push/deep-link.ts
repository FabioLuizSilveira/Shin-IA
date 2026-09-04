// Wave 4 Phase C — a closed union, not a free-text URL. A push payload can
// only ever carry one of these known target shapes; there is no code path
// that turns an arbitrary string into a deep link. apps/mobile's real
// registered scheme is "shinacustomer://" (apps/mobile/app.json, also used
// by MOBILE_APP_SCHEME in apps/web/src/lib/domain.ts for the invite-link
// flow) — reused here, not a second scheme invented for push.
export type DeepLinkTarget =
  | { type: "operation"; id: string }
  | { type: "contract"; id: string }
  | { type: "document"; contractId: string; id: string }
  | { type: "tracking_alert"; resourceId: string }
  | { type: "invoice"; id: string }
  | { type: "notification_center" }
  // Added for the Shinã Agent's get_deep_link tool (Wave 2) — apps/mobile
  // already has a real AssetDetail: {assetId} route (navigation.tsx).
  | { type: "asset"; id: string };

const SCHEME = "shinacustomer://";

export function buildDeepLinkUrl(target: DeepLinkTarget): string {
  switch (target.type) {
    case "operation":
      return `${SCHEME}operations/${target.id}`;
    case "contract":
      return `${SCHEME}contracts/${target.id}`;
    case "document":
      return `${SCHEME}contracts/${target.contractId}/documents/${target.id}`;
    case "tracking_alert":
      return `${SCHEME}tracking/${target.resourceId}`;
    case "invoice":
      return `${SCHEME}invoices/${target.id}`;
    case "notification_center":
      return `${SCHEME}notifications`;
    case "asset":
      return `${SCHEME}assets/${target.id}`;
  }
}
