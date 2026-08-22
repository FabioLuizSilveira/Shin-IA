import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/domain";

// Mirrors middleware.ts's SITE_PATHS — the only paths actually served by
// the institutional landing (root/www domain). Keep in sync if that list
// changes.
const PATHS = ["/", "/pricing", "/contact", "/about", "/demo", "/privacidade", "/termos"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
