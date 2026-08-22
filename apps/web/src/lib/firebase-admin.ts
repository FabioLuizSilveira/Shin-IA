import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Lazily initialized — importing this module must be side-effect-free even
// when no FIREBASE_ADMIN_* env var is set (the current default: every
// environment runs IDENTITY_PROVIDER=supabase, so this function is never
// actually called yet). Only throws once something tries to use it without
// real credentials configured.
let cachedAuth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_ADMIN_PROJECT_ID/FIREBASE_ADMIN_CLIENT_EMAIL/FIREBASE_ADMIN_PRIVATE_KEY are required when IDENTITY_PROVIDER=firebase",
    );
  }

  const app =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  cachedAuth = getAuth(app);
  return cachedAuth;
}
