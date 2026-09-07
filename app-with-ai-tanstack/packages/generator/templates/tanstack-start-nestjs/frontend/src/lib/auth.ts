/**
 * Authentication Client
 *
 * Direct fetch calls to better-auth HTTP handler on the backend.
 * Uses TanStack Start API routes (/api/* -> backend) so cookies are
 * scoped to the frontend domain and automatically passed with requests.
 *
 * Better-auth standard paths:
 *   GET  /api/auth/get-session
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-out
 */

// Use the Vinxi proxy (relative URL) so cookies are same-origin (localhost:3001).
// The proxy forwards to VITE_API_URL (http://127.0.0.1:3000) avoiding IPv6 issues.
const AUTH_BASE = "/api/auth";

async function authFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const hasBody = options.body != null;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${AUTH_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });

    const text = await res.text();
    let body: T | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      // non-JSON response
    }

    if (!res.ok) {
      const message =
        (body as Record<string, string>)?.message ||
        (body as Record<string, string>)?.error ||
        res.statusText;
      return { data: null, error: message };
    }

    return { data: body, error: null };
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function signIn(email: string, password: string) {
  return authFetch("/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signUp(email: string, password: string, name: string) {
  return authFetch("/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function signOut() {
  return authFetch("/sign-out", { method: "POST" });
}

export async function getSession() {
  return authFetch("/get-session");
}
