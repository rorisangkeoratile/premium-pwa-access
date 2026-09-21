import { mockUsers } from "@/components/lesedi/data";

const KEY = "lesedilink.session";

/** Set to false to hide (and disable) the one-tap role logins on the login page. */
export const QUICK_LOGIN_ENABLED = true;

export type MockUser = (typeof mockUsers)[number];

export function signIn(email: string, password: string): MockUser | null {
  const user = mockUsers.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
  if (!user) return null;
  try { sessionStorage.setItem(KEY, user.email); } catch { /* storage unavailable */ }
  return user;
}

export function quickSignIn(role: MockUser["role"]): MockUser | null {
  if (!QUICK_LOGIN_ENABLED) return null;
  const user = mockUsers.find((item) => item.role === role);
  if (!user) return null;
  return signIn(user.email, user.password);
}

export function currentUser(): MockUser | null {
  try {
    const email = sessionStorage.getItem(KEY);
    return mockUsers.find((item) => item.email === email) ?? null;
  } catch {
    return null;
  }
}

export function signOut() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
