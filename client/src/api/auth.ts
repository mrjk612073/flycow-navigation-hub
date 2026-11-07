import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { NavUser, AuthResponse } from '@shared/api.interface';

const AUTH_TOKEN_KEY = 'compass_auth_token';
const AUTH_USER_KEY = 'compass_auth_user';

// 用户管理用的扩展类型（含 isActive，共享类型里可能还没加）
export interface NavUserExt extends NavUser {
  isActive?: boolean;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function getCachedUser(): NavUserExt | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as NavUserExt) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: NavUserExt): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await axiosForBackend.post('/api/auth/login', {
    username,
    password,
  });
  if (res.data.token) {
    setAuthToken(res.data.token);
    if (res.data.user) setCachedUser(res.data.user);
  }
  return res.data;
}

export async function register(
  username: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const res = await axiosForBackend.post('/api/auth/register', {
    username,
    password,
    displayName,
  });
  if (res.data.token) {
    setAuthToken(res.data.token);
    if (res.data.user) setCachedUser(res.data.user);
  }
  return res.data;
}

export async function getMe(): Promise<{ user: NavUserExt | null }> {
  const token = getAuthToken();
  if (!token) {
    return { user: null };
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      clearAuthToken();
      return { user: null };
    }
    const payloadB64 = parts[1];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      clearAuthToken();
      return { user: null };
    }
  } catch {
    clearAuthToken();
    return { user: null };
  }
  try {
    const res = await axiosForBackend.get('/api/auth/me', {
      headers: { 'x-app-auth': `Bearer ${token}` },
    });
    return res.data;
  } catch {
    return { user: null };
  }
}

export async function getUsers(): Promise<{ users: NavUserExt[] }> {
  const res = await axiosForBackend.get('/api/auth/users', {
    headers: { 'x-app-auth': `Bearer ${getAuthToken()}` },
  });
  return res.data;
}

export async function updateUser(
  id: string,
  data: {
    displayName?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
  },
): Promise<{ user: NavUserExt }> {
  const res = await axiosForBackend.patch(`/api/auth/users/${id}`, data, {
    headers: { 'x-app-auth': `Bearer ${getAuthToken()}` },
  });
  return res.data;
}

export async function deleteUser(id: string): Promise<{ success: true }> {
  const res = await axiosForBackend.delete(`/api/auth/users/${id}`, {
    headers: { 'x-app-auth': `Bearer ${getAuthToken()}` },
  });
  return res.data;
}

export async function createUser(data: {
  username: string;
  password: string;
  displayName: string;
  role?: string;
}): Promise<{ user: NavUserExt }> {
  const res = await axiosForBackend.post('/api/auth/users', data, {
    headers: { 'x-app-auth': `Bearer ${getAuthToken()}` },
  });
  return res.data;
}

export function logout(): void {
  clearAuthToken();
}
