function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Thiếu cấu hình Supabase trên server.");
  return { url: url.replace(/\/$/, ""), anonKey };
}

function authToken(token) {
  return String(token || "").replace(/^Bearer\s+/i, "").trim();
}

function headers(token, extra = {}) {
  const { anonKey } = config();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${authToken(token)}`,
    ...extra,
  };
}

function queryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export async function supabaseTableRequest(table, token, { method = "GET", query, body, prefer = "return=representation" } = {}) {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/${table}${queryString(query)}`, {
    method,
    headers: headers(token, {
      "Content-Type": "application/json",
      Prefer: prefer,
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.details || payload?.error_description || `Supabase trả về lỗi ${response.status}.`;
    const error = new Error(String(message));
    error.status = response.status;
    error.supabase = payload;
    throw error;
  }
  return payload;
}

export async function uploadImportObject(path, file, token) {
  const { url } = config();
  const response = await fetch(`${url}/storage/v1/object/guideline-imports/${path}`, {
    method: "POST",
    headers: headers(token, {
      "Content-Type": file.mimetype || "application/octet-stream",
      "Content-Length": String(file.size || file.buffer?.length || 0),
      "x-upsert": "false",
    }),
    body: file.buffer,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || `Không thể lưu file import (${response.status}).`);
    error.status = response.status;
    error.supabase = payload;
    throw error;
  }
  return payload;
}

export async function deleteImportObject(path, token) {
  const { url } = config();
  await fetch(`${url}/storage/v1/object/guideline-imports/${path}`, {
    method: "DELETE",
    headers: headers(token),
  }).catch(() => null);
}

export function tokenFromRequest(req) {
  return req.get("authorization") || "";
}
