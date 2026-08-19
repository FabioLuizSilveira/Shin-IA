// Wikimedia's upload host (where the demo fleet's car photos live) returns
// 403 for any request without a browser-like User-Agent — confirmed via
// curl: no UA and Android's default "okhttp/x.x.x" UA (what RN's image
// loader sends by default) both get blocked, a plain browser UA doesn't.
// expo-image's source accepts per-image request headers, so this is applied
// at the Image source rather than globally.
export const HOTLINK_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
};
