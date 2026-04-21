const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Only set Content-Type for JSON bodies (not FormData)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || res.statusText);
  }
  return res.json();
}

export interface AuthUser {
  id: string;
  email: string;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string) =>
      request<{ token: string; user: AuthUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: AuthUser }>("/auth/me"),
  },

  cargos: {
    list: () => request<any[]>("/cargos"),
    get: (id: string) => request<any | null>(`/cargos/${id}`),
    create: (data: any) => request<any>("/cargos", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/cargos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/cargos/${id}`, { method: "DELETE" }),
    autoTransit: () => request<any>("/cargos/auto-transit", { method: "POST" }),
    stats: () => request<{ total: number; inTransit: number; warehouses: number }>("/cargos/stats"),
  },

  packages: {
    list: () => request<any[]>("/packages"),
    listSummary: () => request<any[]>("/packages?fields=cargo_id,price,currency"),
    listByCargo: (cargoId: string) => request<any[]>(`/packages/by-cargo/${cargoId}`),
    create: (data: any) => request<any>("/packages", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/packages/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/packages/${id}`, { method: "DELETE" }),
  },

  warehouses: {
    list: () => request<any[]>("/warehouses"),
    getFirst: () => request<any | null>("/warehouses/first"),
    create: (data: any) => request<any>("/warehouses", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/warehouses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },

  sections: {
    list: (warehouseId?: string) =>
      request<any[]>(`/sections${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`),
    withWarehouse: (ids: string[]) =>
      request<any[]>(`/sections/with-warehouse?ids=${ids.join(",")}`),
    create: (data: any) => request<any>("/sections", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/sections/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/sections/${id}`, { method: "DELETE" }),
  },

  upload: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "Upload failed");
    }
    const { url } = await res.json();
    return url;
  },
};
