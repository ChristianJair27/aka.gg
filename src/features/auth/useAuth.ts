// Auth con store compartido a nivel de módulo. Antes cada componente tenía su
// propia copia (useState local leyendo localStorage al montar): el Login hacía
// setUser en SU instancia y la Navbar no se enteraba hasta recargar la página.
// Ahora todos los consumidores se suscriben al mismo estado con
// useSyncExternalStore y reaccionan al instante a login/logout (y a cambios de
// sesión en otras pestañas vía el evento 'storage').
import { useSyncExternalStore } from 'react';
import { authApi } from './auth.api';
import { User, LoginRequest, RegisterRequest } from './types';

type AuthSnapshot = { user: User | null; isAuthenticated: boolean };

function readSnapshot(): AuthSnapshot {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { user: null, isAuthenticated: false };
    const raw = localStorage.getItem('user');
    return { user: raw ? (JSON.parse(raw) as User) : null, isAuthenticated: true };
  } catch {
    return { user: null, isAuthenticated: false };
  }
}

let snapshot: AuthSnapshot = readSnapshot();
const listeners = new Set<() => void>();

function emit() {
  snapshot = readSnapshot();
  listeners.forEach((l) => l());
}

/** Re-lee la sesión desde localStorage y notifica a todos los componentes.
 *  Úsalo tras escribir el token a mano (p.ej. payload de OAuth). */
export function syncAuthFromStorage() {
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cambios de sesión hechos en OTRA pestaña.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'access_token' || e.key === 'user') emit();
  });
}

export const useAuth = () => {
  const snap = useSyncExternalStore(subscribe, () => snapshot);

  const login = async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials);
    localStorage.setItem('access_token', response.token);
    if (response.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    emit(); // navbar y demás consumidores se actualizan al momento
    return response;
  };

  const register = async (userData: RegisterRequest) => {
    await authApi.register(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      emit();
      window.location.href = '/login';
    }
  };

  return {
    user: snap.user,
    isAuthenticated: snap.isAuthenticated,
    // El estado es síncrono (localStorage): nunca hay carga pendiente.
    isLoading: false,
    login,
    register,
    logout,
  };
};
