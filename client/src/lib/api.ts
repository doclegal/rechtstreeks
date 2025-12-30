import { getAccessToken, clearAccessToken } from "./authStore";

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
  
  if (res.status === 401) {
    clearAccessToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
  
  return res;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await apiFetch(url, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
