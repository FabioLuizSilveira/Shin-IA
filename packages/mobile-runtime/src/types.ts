export type SyncStatus = "idle" | "syncing" | "error" | "pending";
export type OperationType = "create" | "update" | "delete";
export type PushPlatform = "apns" | "fcm";
export type TrackingEventType = "location" | "asset_scan" | "checkin" | "checkout" | "alert";
export type DocumentStatus = "draft" | "pending_signature" | "signed" | "expired";
export type SignatureStatus = "pending" | "signed" | "declined" | "expired";

export interface SyncQueueItem {
  id: string;
  operation: OperationType;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttemptAt?: string;
}

export interface PushTokenRecord {
  tenantId: string;
  userId: string;
  token: string;
  platform: PushPlatform;
  registeredAt: string;
  lastSeenAt?: string;
}

export interface PushNotificationPayload {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduledFor?: string;
  deliveredAt?: string;
  status: "pending" | "delivered" | "failed" | "cancelled";
}

export interface TrackingEvent {
  id: string;
  tenantId: string;
  userId: string;
  type: TrackingEventType;
  latitude?: number;
  longitude?: number;
  assetId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface MobileBranding {
  tenantId: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  appName: string;
  fontFamily?: string;
  splashColor?: string;
}

export interface MobileDocument {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  content: string;
  status: DocumentStatus;
  createdAt: string;
  expiresAt?: string;
}

export interface ContractSignature {
  id: string;
  documentId: string;
  signerId: string;
  signerName: string;
  status: SignatureStatus;
  requestedAt: string;
  signedAt?: string;
}
