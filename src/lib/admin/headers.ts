// Edge-safe (no Node imports): used by middleware as well as the admin routes.
/** Headers for every admin response: never cached, never indexed, no referrer leaks. */
export const adminHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
};
