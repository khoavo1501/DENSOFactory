// Lightweight API client. Sends cookies; reads X-CSRF-Token from cookie "csrf"
// and echoes it in the X-CSRF-Token header for state-changing methods.

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCookie("csrf");
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  const init: RequestInit = { method, headers, credentials: "include" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  if (signal) {
    init.signal = signal;
  }

  const res = await fetch(API_BASE + path, init);
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : null) || `HTTP ${res.status}`;
    throw new ApiError(detail, res.status, parsed);
  }
  return parsed as T;
}
