const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

function getTokens() {
  if (typeof window === 'undefined') return { accessToken: null, entityId: null };
  return {
    accessToken: localStorage.getItem('accessToken'),
    entityId: localStorage.getItem('entityId'),
  };
}

export function setTokens(accessToken: string, entityId: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('entityId', entityId);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('entityId');
}

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, headers: extraHeaders, ...rest } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') searchParams.set(k, String(v));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const { accessToken, entityId } = getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (entityId) headers['X-Entity-Id'] = entityId;

  let res = await fetch(url, { ...rest, headers, credentials: 'include' });

  if (res.status === 401 && accessToken) {
    const newToken = await tryRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...rest, headers, credentials: 'include' });
    } else {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const { accessToken, entityId } = getTokens();
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (entityId) headers['X-Entity-Id'] = entityId;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Upload error ${res.status}`);
  }

  return res.json() as Promise<T>;
}
