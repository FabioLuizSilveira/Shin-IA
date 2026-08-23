"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// Same Firebase project as apps/web (spec item 25: no second Firebase
// project/identity pool) — so the same account works across Shinã Platform
// and Shinã MKT.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// getApps()[0] guard so Fast Refresh / repeated client-component mounts
// don't throw "Firebase App named '[DEFAULT]' already exists".
const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
