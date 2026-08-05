// Security fix (MÉD-11): the Supabase session (including the refresh
// token) used to be persisted via expo-sqlite's localStorage polyfill — an
// unencrypted on-device SQLite file, recoverable from app-sandbox storage
// or a device backup on a rooted/jailbroken device, without any OS-level
// encryption tied to the device's Keystore/Keychain.
//
// SecureStore alone can't hold the session directly: its values are capped
// at ~2KB, and a Supabase session (JWT + refresh token + user metadata)
// routinely exceeds that. This is Supabase's own documented pattern for
// Expo/React Native: a random AES-256 key lives in SecureStore (small,
// Keystore/Keychain-backed), and the actual session blob is encrypted with
// that key before being persisted in AsyncStorage — so the on-disk value is
// useless without the key, which itself never leaves secure hardware
// storage.
import "react-native-get-random-values";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

export const secureSessionStore = new LargeSecureStore();
