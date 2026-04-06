function trimTrailingSlash(url) {
  if (!url) return "";
  return String(url).replace(/\/$/, "");
}

/** Public SPA origin — set VITE_FRONTEND_URL in .env */
export const frontend_url = trimTrailingSlash(
  import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173"
);

/** API base URL — set VITE_BACKEND_URL in .env (VITE_API_BASE_URL still supported) */
export const backend_url = trimTrailingSlash(
  import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000"
);
