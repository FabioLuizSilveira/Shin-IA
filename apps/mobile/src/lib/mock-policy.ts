// M22 — mock/demo policy. Single source of truth for "is it allowed to
// show fake data right now", so there is exactly one place to audit or
// test instead of a flag check copy-pasted into every screen/adapter.
//
// DEVELOPMENT: mocks/demo login allowed only when EXPO_PUBLIC_ENABLE_MOCKS
// is explicitly "1" — never on by default, even in dev.
// STAGING/PRODUCTION: impossible, full stop, regardless of any env var.
// __DEV__ is Expo/Metro's own build-time flag (true only for a dev-client/
// Expo Go bundle, false in every `eas build` release/production profile) —
// it is not something a runtime env var can override, so this is the actual
// enforcement boundary, not just a convention.
export function areMocksAllowed(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_ENABLE_MOCKS === "1";
}
