import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { tenantApi, userApi } from '../mock/api';

const AppCtx = createContext(null);

const SESSION_KEY = 'hrms_session_v1';

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [tenants, setTenants] = useState([]);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await tenantApi.list();
      if (!cancelled) {
        setTenants(list);
        setBootLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async ({ user, tenantId }) => {
    const s = {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      tenantId: tenantId ?? user.tenantId ?? null,
      loggedAt: new Date().toISOString(),
    };
    setSession(s);
    saveSession(s);
    return s;
  };

  const switchTenant = (tenantId) => {
    if (!session) return;
    const s = { ...session, tenantId };
    setSession(s);
    saveSession(s);
  };

  const logout = () => {
    setSession(null);
    clearSession();
  };

  const refreshTenants = async () => {
    setTenants(await tenantApi.list());
  };

  const tenant = useMemo(
    () => tenants.find((t) => t.id === session?.tenantId) || null,
    [tenants, session],
  );

  const value = {
    session,
    tenant,
    tenants,
    role: session?.role,
    bootLoading,
    login,
    logout,
    switchTenant,
    refreshTenants,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export async function loginByEmail(email) {
  const u = await userApi.byEmail(email);
  return u;
}
