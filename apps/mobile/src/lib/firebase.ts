import { getApps, initializeApp } from "firebase/app";
import { initializeAuth, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Known firebase-js-sdk TypeScript gap (firebase/firebase-js-sdk#9316,
// #7615): getReactNativePersistence exists at runtime under "firebase/auth"
// (Metro's RN resolver picks the right build), but isn't in that entry
// point's public .d.ts under plain `tsc` module resolution.
// @ts-expect-error — see firebase/firebase-js-sdk#9316, runtime export is real
import { getReactNativePersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

// initializeAuth (not getAuth) so session persistence is explicit —
// without a configured persistence, Firebase's RN auth defaults to
// in-memory only and silently forgets the session on every app restart.
// AsyncStorage is already a dependency (used elsewhere in this app), same
// storage layer Firebase's own docs recommend for Expo.
let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  return cachedAuth;
}
