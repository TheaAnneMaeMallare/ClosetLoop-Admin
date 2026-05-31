const ADMIN_SESSION_KEY = "closetloopAdminSession";

export const THIRTY_MINUTES_MS = 30 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function readSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function initializeAdminSession(rememberMe) {
  const now = Date.now();
  const maxAgeMs = rememberMe ? SEVEN_DAYS_MS : THIRTY_MINUTES_MS;

  writeSession({
    rememberMe,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + maxAgeMs,
    maxAgeMs,
  });
}

export function touchAdminSession() {
  const session = readSession();

  if (!session) return;

  writeSession({
    ...session,
    lastActivityAt: Date.now(),
  });
}

export function isAdminSessionExpired() {
  const session = readSession();

  if (!session) return true;

  const now = Date.now();
  const maxAgeMs = Number(session.maxAgeMs || 0);
  const lastActivityAt = Number(session.lastActivityAt || 0);
  const expiresAt = Number(session.expiresAt || 0);

  return now > expiresAt || now - lastActivityAt > maxAgeMs;
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}
