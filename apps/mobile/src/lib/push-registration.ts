import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { shinaia } from "./shinaia-api";

// M23 — closes the "expo-notifications não instalado" gap from
// MOBILE_RELEASE_CHECKLIST.md. Registers with the real
// POST /api/mobile/devices (Wave 4 Phase C) using an Expo push token.
//
// Getting a real token requires an EAS project id (app.json's
// extra.eas.projectId, set by `eas init`) — eas.json doesn't exist yet in
// this repo (documented gap), so this degrades gracefully: on a device/
// build without a linked EAS project, registerForPushNotifications()
// resolves to null instead of throwing, and callers simply skip
// registration. Nothing here invents a token or a project id.
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null; // push tokens don't exist on simulators

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== "granted") {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("[push] no EAS projectId configured — skipping push token registration");
    return null;
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  const deviceId = Application.getAndroidId?.() ?? Constants.sessionId ?? expoPushToken;
  await shinaia.registerDevice({
    deviceId,
    pushToken: expoPushToken,
    platform: Platform.OS === "ios" ? "ios" : "android",
    appVersion: Application.nativeApplicationVersion ?? undefined,
  });

  return deviceId;
}

// M22.13/M23 — called on logout so the device stops receiving push for the
// account that just signed out (server-side disable, not just forgetting
// the token locally).
export async function unregisterCurrentDevice(deviceId: string | null): Promise<void> {
  if (!deviceId) return;
  try {
    await shinaia.disableDevice(deviceId);
  } catch {
    // Best-effort — logout must never be blocked by a push-unregister
    // failure (e.g. offline at the moment of logout).
  }
}
