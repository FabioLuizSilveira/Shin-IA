import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/domain";

// Next.js metadata route — generates /robots.txt at the root of whatever
// host serves this request. The app subdomain is already marked
// noindex/nofollow via the X-Robots-Tag response header set in
// middleware.ts; this file only needs to cover the public marketing site.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
