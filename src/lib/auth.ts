import { mockUsers, type MockUser, type Role } from "@/components/lesedi/data";
import { createStore } from "@/lib/store";

export type { MockUser, Role };

const SESSION_KEY = "lesedilink.session";
const PENDING_KEY = "lesedilink.pending-otp";

/** Set to false to hide (and disable) the one-tap logins on the login page. Every one-tap login still needs the OTP. */
export const QUICK_LOGIN_ENABLED = true;

/**
 * Demo only. This prototype has no SMS gateway, so when true the one-time PIN is shown on screen in a
 * "demo phone" box instead of being texted. Set to false before real users see the app, then send the
 * code from your server in `deliverOtp`.
 */
export const SHOW_DEMO_OTP = true;

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RESEND_MS = 30 * 1000;

/** Accounts created through the sign-up page (browser storage stands in for a database). Passwords are stored as salted hashes. */
export const accountStore = createStore<MockUser[]>("lesedilink.accounts", []);
const credentialStore = createStore<Record<string, { salt: string; hash: string }>>("lesedilink.credentials", {});

type SignupPayload = { user: MockUser; salt: string; hash: string };
type PendingOtp = { purpose: "login" | "signup"; email: string; code: string; issuedAt: number; expiresAt: number; attempts: number; signup?: SignupPayload };

const read = <T>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
const remove = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

const allUsers = (): MockUser[] => [...mockUsers, ...accountStore.get()];
const findUser = (email: string) => allUsers().find((item) => item.email === email) ?? null;
export const emailTaken = (email: string) => findUser(email.trim().toLowerCase()) !== null;

function newCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0]! % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Salted SHA-256. Browsers only offer it on HTTPS or localhost, so plain-HTTP dev falls back to a weak hash. */
async function hashPassword(password: string, salt: string): Promise<string> {
  const text = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `weak-${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`;
}

/** Where the code would be texted. Replace the body with a call to your SMS provider once there is a backend. */
function deliverOtp(_user: MockUser, _code: string) {
  /* Prototype: nothing is sent. With SHOW_DEMO_OTP the login page reveals the code instead. */
}

export const maskPhone = (phone: string) => `${phone.slice(0, 3)} ••• ${phone.slice(-4)}`;

function issue(user: MockUser, purpose: PendingOtp["purpose"], signup?: SignupPayload) {
  const now = Date.now();
  const pending: PendingOtp = { purpose, email: user.email, code: newCode(), issuedAt: now, expiresAt: now + OTP_TTL_MS, attempts: 0, ...(signup ? { signup } : {}) };
  write(PENDING_KEY, pending);
  deliverOtp(user, pending.code);
  return user;
}

/** Step 1: check the password, then send a one-time PIN. No session exists until the PIN is verified. */
export async function startLogin(email: string, password: string): Promise<MockUser | null> {
  const address = email.trim().toLowerCase();
  const seeded = mockUsers.find((item) => item.email === address && item.password === password);
  if (seeded) return issue(seeded, "login");

  const user = accountStore.get().find((item) => item.email === address);
  const credential = credentialStore.get()[address];
  if (user && credential && (await hashPassword(password, credential.salt)) === credential.hash) return issue(user, "login");
  return null;
}

/** Demo shortcut: skips the password only. The one-time PIN is still required. */
export function startQuickLogin(email: string): MockUser | null {
  if (!QUICK_LOGIN_ENABLED) return null;
  const user = mockUsers.find((item) => item.email === email);
  return user ? issue(user, "login") : null;
}

export type NewCustomer = { name: string; email: string; phone: string; password: string; area: string; areaId?: string | undefined };

/**
 * Sign-up, step 1: check the details, then text a code to the phone number to prove it belongs to them.
 * The account is not created until the code is entered.
 */
export async function startSignup(details: NewCustomer): Promise<{ ok: true; user: MockUser } | { ok: false; error: string }> {
  const email = details.email.trim().toLowerCase();
  if (emailTaken(email)) return { ok: false, error: "An account with this email already exists. Please log in instead." };
  const salt = randomSalt();
  const user: MockUser = {
    role: "Customer",
    name: details.name.trim(),
    email,
    phone: details.phone.trim(),
    to: "/dashboard/customer",
    area: details.area,
    ...(details.areaId ? { areaId: details.areaId } : {}),
  };
  const hash = await hashPassword(details.password, salt);
  issue(user, "signup", { user, salt, hash });
  return { ok: true, user };
}

/** The user waiting to enter a PIN, if any, with the timing needed to drive the screen. */
export function pendingLogin(): { purpose: PendingOtp["purpose"]; user: MockUser; issuedAt: number; expiresAt: number; attemptsLeft: number } | null {
  const pending = read<PendingOtp>(PENDING_KEY);
  const user = pending ? (pending.signup?.user ?? findUser(pending.email)) : null;
  return pending && user ? { purpose: pending.purpose, user, issuedAt: pending.issuedAt, expiresAt: pending.expiresAt, attemptsLeft: OTP_MAX_ATTEMPTS - pending.attempts } : null;
}

/** The code, for the demo phone box. Returns null when SHOW_DEMO_OTP is off. */
export function demoOtp(): string | null {
  return SHOW_DEMO_OTP ? (read<PendingOtp>(PENDING_KEY)?.code ?? null) : null;
}

export function resendOtp(): MockUser | null {
  const pending = read<PendingOtp>(PENDING_KEY);
  const waiting = pendingLogin();
  if (!pending || !waiting || Date.now() - waiting.issuedAt < OTP_RESEND_MS) return null;
  return issue(waiting.user, pending.purpose, pending.signup);
}

export function cancelLogin() {
  remove(PENDING_KEY);
}

export type OtpResult = { status: "ok"; user: MockUser } | { status: "wrong"; attemptsLeft: number } | { status: "expired" } | { status: "locked" };

/** Step 2: check the PIN. Three wrong tries or five minutes and the PIN is destroyed. A correct PIN for a sign-up creates the account. */
export function verifyOtp(code: string): OtpResult {
  const pending = read<PendingOtp>(PENDING_KEY);
  const user = pending ? (pending.signup?.user ?? findUser(pending.email)) : null;
  if (!pending || !user) return { status: "expired" };
  if (Date.now() > pending.expiresAt) {
    remove(PENDING_KEY);
    return { status: "expired" };
  }
  if (code !== pending.code) {
    const attempts = pending.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      remove(PENDING_KEY);
      return { status: "locked" };
    }
    write(PENDING_KEY, { ...pending, attempts });
    return { status: "wrong", attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
  }
  if (pending.signup) {
    if (emailTaken(user.email)) {
      remove(PENDING_KEY);
      return { status: "expired" };
    }
    accountStore.set([...accountStore.get(), pending.signup.user]);
    credentialStore.set({ ...credentialStore.get(), [user.email]: { salt: pending.signup.salt, hash: pending.signup.hash } });
  }
  remove(PENDING_KEY);
  write(SESSION_KEY, user.email);
  return { status: "ok", user };
}

export function currentUser(): MockUser | null {
  const email = read<string>(SESSION_KEY);
  return email ? findUser(email) : null;
}

export function signOut() {
  remove(SESSION_KEY);
  remove(PENDING_KEY);
}
