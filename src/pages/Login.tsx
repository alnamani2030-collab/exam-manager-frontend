import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  OAuthProvider,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { doc, getDoc, getDocFromCache } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { callFn } from "../services/functionsClient";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  resolveHomePath,
  resolvePrimaryRoleLabel,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { useI18n } from "../i18n/I18nProvider";

// ضع صورة الخلفية في هذا المسار:
// src/assets/login-bg.png

// Default to disabling Cloud Functions unless explicitly enabled.
const DISABLE_FUNCTIONS =
  String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";

const ALLOWLIST_CACHE_PREFIX = "exam-manager:auth:allowlist:";
const ALLOWLIST_READ_TIMEOUT_MS = 3500;

type AllowlistDoc = {
  email: string;
  enabled: boolean;
  role: "super_admin" | "ministry_super" | "super" | "exam_super" | "tenant_admin" | "admin" | "user";
  tenantId: string;
};

type Lang = "ar" | "en";

const STR = {
  ar: {
    title: "نظام الامتحانات المدرسية المطور",
    subtitle: "تسجيل دخول آمن للمستخدمين المصرح لهم فقط",
    ministry: "سلطنة عمان - وزارة  التعليم",
    signIn: "Google تسجيل الدخول بواسطة",
    microsoftSignIn: "تسجيل الدخول بالبريد الوزاري Microsoft",
    signedInAs: "تم تسجيل الدخول:",
    status: "الحالة:",
    active: "مفعّل ✅",
    inactive: "غير مفعّل",
    inactiveHint: "(غير موجود في allowlist أو enabled=false)",
    tenant: "الجهة:",
    role: "الصلاحية:",
    refresh: "تحديث الصلاحيات",
    logout: "تسجيل خروج",
    loading: "جاري المعالجة...",
    okGo: "الانتقال للنظام",
    footer: "© جميع الحقوق محفوظة",
    developer: "المطور المعتمد",
    teacher: "الأستاذ: يوسف النعماني",
    errPopupClosed: "تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.",
    errNotAllowed: "تم تسجيل الدخول لكن حسابك غير مفعّل من مدير النظام.",
    errMoeOnly: "يسمح بتسجيل الدخول بالبريد الوزاري الذي ينتهي بـ @moe.om فقط.",
    errMicrosoftEmailMissing: "تم تسجيل الدخول عبر Microsoft لكن لم نستطع قراءة البريد الوزاري من الحساب.",
    errGeneric: "حدث خطأ. تأكد من إعدادات Firebase وجرّب مرة أخرى.",
  },
  en: {
    title: "Enhanced School Exam System",
    subtitle: "Secure login for authorized users only",
    ministry: "Sultanate of Oman - Ministry of Education",
    signIn: "Sign in with Google",
    microsoftSignIn: "Sign in with MOE Microsoft email",
    signedInAs: "Signed in as:",
    status: "Status:",
    active: "Active ✅",
    inactive: "Inactive",
    inactiveHint: "(Not in allowlist or enabled=false)",
    tenant: "Tenant:",
    role: "Role:",
    refresh: "Refresh permissions",
    logout: "Sign out",
    loading: "Processing...",
    okGo: "Go to app",
    footer: "© All rights reserved",
    developer: "Certified Developer",
    teacher: "Teacher: Youssef Al-Numani",
    errPopupClosed: "Login popup closed before completing.",
    errNotAllowed: "Signed in, but your account is not enabled by the admin.",
    errMoeOnly: "Only @moe.om ministry email accounts are allowed for Microsoft sign-in.",
    errMicrosoftEmailMissing: "Microsoft sign-in succeeded, but the ministry email could not be read.",
    errGeneric: "Something went wrong. Check Firebase setup and try again.",
  },
} as const;


function normalizeLoginEmail(value: any): string {
  return String(value || "").trim().toLowerCase();
}

// ✅ قائمة إيميلات مالك المنصة.
// أضف الإيميل الثاني مكان SECOND_OWNER_EMAIL_HERE إذا أردت الاعتماد على الكود مباشرة،
// أو أضفه في allowlist بدور super_admin و enabled=true بدون تعديل الكود مرة أخرى.
const PLATFORM_OWNER_EMAILS = [
  "3asal2030@gmail.com",
  "yousef.namani@moe.om",
]
  .map(normalizeLoginEmail)
  .filter((email) => email && email !== "yousef.namani@moe.om");

function isPlatformOwnerLoginEmail(email: any): boolean {
  const clean = normalizeLoginEmail(email);
  return !!clean && PLATFORM_OWNER_EMAILS.includes(clean);
}

function isMoeEmail(email: string): boolean {
  return normalizeLoginEmail(email).endsWith("@moe.om");
}

function decodeJwtPayload(token?: string | null): Record<string, any> {
  if (!token || typeof token !== "string") return {};
  const parts = token.split(".");
  if (parts.length < 2) return {};

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      Array.from(atob(padded))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function getEmailFromObject(source: any): string {
  if (!source) return "";
  const candidates = [
    source.email,
    source.mail,
    source.userPrincipalName,
    source.user_principal_name,
    source.preferred_username,
    source.upn,
    source.unique_name,
    source.login_hint,
    source.account,
  ];

  for (const candidate of candidates) {
    const email = normalizeLoginEmail(candidate);
    if (email.includes("@")) return email;
  }

  return "";
}

function safeJsonParse(value: any): any {
  if (!value || typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

function collectEmailCandidates(value: any, out: string[] = [], seen = new WeakSet<object>(), depth = 0): string[] {
  if (depth > 5 || value == null) return out;

  if (typeof value === "string") {
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const match of matches) {
      const email = normalizeLoginEmail(match);
      if (email && !out.includes(email)) out.push(email);
    }
    const parsed = safeJsonParse(value);
    if (parsed) collectEmailCandidates(parsed, out, seen, depth + 1);
    return out;
  }

  if (typeof value !== "object") return out;
  if (seen.has(value)) return out;
  seen.add(value);

  const direct = getEmailFromObject(value);
  if (direct && !out.includes(direct)) out.push(direct);

  for (const key of Object.keys(value)) {
    if (key.toLowerCase().includes("token") && typeof value[key] === "string") {
      const claims = decodeJwtPayload(value[key]);
      collectEmailCandidates(claims, out, seen, depth + 1);
    } else if (key !== "app" && key !== "auth") {
      collectEmailCandidates(value[key], out, seen, depth + 1);
    }
  }

  return out;
}

function pickBestEmail(candidates: string[]): string {
  const clean = candidates.map(normalizeLoginEmail).filter((x, i, arr) => x.includes("@") && arr.indexOf(x) === i);
  return clean.find(isMoeEmail) || clean[0] || "";
}

function getFirebaseUserEmail(user: User | null): string {
  if (!user) return "";

  const direct = normalizeLoginEmail(user.email);
  if (direct) return direct;

  for (const provider of user.providerData || []) {
    const email = normalizeLoginEmail(provider?.email);
    if (email) return email;
  }

  if (typeof window !== "undefined" && user.uid) {
    try {
      const stored = normalizeLoginEmail(window.localStorage.getItem(`exam-manager:microsoft-email:${user.uid}`));
      if (stored) return stored;
    } catch {
      // ignore
    }
  }

  return "";
}

function writeStoredProviderEmail(uid: string | undefined, email: string) {
  if (typeof window === "undefined" || !uid) return;
  const clean = normalizeLoginEmail(email);
  if (!clean) return;
  try {
    window.localStorage.setItem(`exam-manager:microsoft-email:${uid}`, clean);
  } catch {
    // ignore
  }
}

async function getTokenClaimEmail(user: User | null): Promise<string> {
  if (!user) return "";
  try {
    const token = await user.getIdTokenResult(true);
    return getEmailFromObject(token.claims || {});
  } catch {
    return "";
  }
}

async function fetchMicrosoftGraphEmail(accessToken?: string | null): Promise<string> {
  if (!accessToken || typeof fetch === "undefined") return "";

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return "";
    const data = await response.json();
    const direct = getEmailFromObject(data);
    if (direct) return direct;
    if (Array.isArray(data?.otherMails)) {
      for (const item of data.otherMails) {
        const email = normalizeLoginEmail(item);
        if (email.includes("@")) return email;
      }
    }
  } catch {
    // ignore
  }

  return "";
}

async function getMicrosoftLoginEmail(result: UserCredential): Promise<string> {
  const credential = OAuthProvider.credentialFromResult(result) as any;
  const profile = (getAdditionalUserInfo(result)?.profile || {}) as Record<string, any>;
  const tokenResponse = (result as any)?._tokenResponse || {};
  const rawUserInfo = safeJsonParse(tokenResponse.rawUserInfo) || {};
  const idTokenClaims = decodeJwtPayload(credential?.idToken || credential?.oauthIdToken || tokenResponse.oauthIdToken || tokenResponse.idToken);
  const accessTokenClaims = decodeJwtPayload(credential?.accessToken || credential?.oauthAccessToken || tokenResponse.oauthAccessToken || tokenResponse.accessToken);
  const graphEmail = await fetchMicrosoftGraphEmail(credential?.accessToken || credential?.oauthAccessToken || tokenResponse.oauthAccessToken || tokenResponse.accessToken);
  const firebaseClaimEmail = await getTokenClaimEmail(result.user);

  const candidates = collectEmailCandidates({
    firebaseUserEmail: getFirebaseUserEmail(result.user),
    profile,
    tokenResponse,
    rawUserInfo,
    idTokenClaims,
    accessTokenClaims,
    firebaseClaimEmail,
    graphEmail,
  });

  return pickBestEmail(candidates);
}

function normalizeAllowlistData(email: string, raw: Partial<AllowlistDoc> | null): AllowlistDoc | null {
  const key = String(email || "").trim().toLowerCase();
  const isHardcodedOwner = isPlatformOwnerLoginEmail(key);

  // ✅ مالك المنصة المعرّف داخل القائمة يدخل حتى لو لم يكن له مستند في allowlist.
  if (!raw) {
    if (isHardcodedOwner) {
      return {
        email: key,
        enabled: true,
        role: "super_admin",
        tenantId: "system",
      };
    }
    return null;
  }

  const data: Partial<AllowlistDoc> = { ...raw };

  if (!data.email) data.email = key;
  if (typeof data.enabled !== "boolean") data.enabled = false;

  const r = String((data as any).role ?? "user").trim().toLowerCase();

  if (isHardcodedOwner) {
    (data as any).role = "super_admin";
    (data as any).enabled = true;
    (data as any).tenantId = "system";
  } else if (r === "super_admin" || r === "super admin" || r === "superadmin" || r === "owner" || r === "platform_owner" || r === "platform owner") {
    (data as any).role = "super_admin";
  } else if (r === "ministry_super" || r === "ministry super" || r === "ministry-super") {
    (data as any).role = "ministry_super";
  } else if (r === "super" || r === "governorate_super" || r === "governorate-super" || r === "سوبر المحافظة" || r === "مشرف المحافظة") {
    (data as any).role = "super";
  } else if (
    r === "exam_super" ||
    r === "exam super" ||
    r === "exam-super" ||
    r === "super_exam" ||
    r === "super-exam" ||
    r === "exam_center_admin" ||
    r === "diploma_center_admin" ||
    r === "diploma_super" ||
    r === "center_admin" ||
    r === "control_admin"
  ) {
    (data as any).role = "exam_super";
  } else if (r === "tenant_admin" || r === "tenant admin" || r === "tenant-admin" || r === "school_admin" || r === "school-admin") {
    (data as any).role = "tenant_admin";
  } else if (r === "admin") {
    (data as any).role = "admin";
  } else {
    (data as any).role = "user";
  }

  if (!data.tenantId) data.tenantId = "default";

  return data as AllowlistDoc;
}


function cacheKeyForAllowlist(email: string) {
  return `${ALLOWLIST_CACHE_PREFIX}${String(email || "").trim().toLowerCase()}`;
}

function readCachedAllowlist(email: string): AllowlistDoc | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKeyForAllowlist(email));
    if (!raw) return normalizeAllowlistData(email, null);
    return normalizeAllowlistData(email, JSON.parse(raw) as Partial<AllowlistDoc>);
  } catch {
    return null;
  }
}

function writeCachedAllowlist(email: string, allow: AllowlistDoc | null) {
  if (typeof window === "undefined" || !allow) return;

  try {
    window.localStorage.setItem(
      cacheKeyForAllowlist(email),
      JSON.stringify({ ...allow, cachedAt: Date.now() })
    );
  } catch {
    // Cache failure must never block login.
  }
}

function withLoginTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });

  // إذا تأخر Firestore ثم فشل بعد انتهاء المهلة لا نريد Unhandled Promise في Console.
  promise.catch(() => undefined);

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

async function fetchAllowlist(email: string): Promise<AllowlistDoc | null> {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return null;

  const ref = doc(db, "allowlist", key);
  const cached = readCachedAllowlist(key);

  try {
    const snap = await withLoginTimeout(getDoc(ref), ALLOWLIST_READ_TIMEOUT_MS, "allowlist-read-timeout");

    if (!snap.exists()) return cached;

    const allow = normalizeAllowlistData(key, snap.data() as Partial<AllowlistDoc>);
    writeCachedAllowlist(key, allow);
    return allow;
  } catch {
    // عند ضعف الاتصال نحاول قراءة نسخة Firestore المحلية ثم كاش البرنامج.
    try {
      const cachedSnap = await getDocFromCache(ref);
      if (cachedSnap.exists()) {
        const allow = normalizeAllowlistData(key, cachedSnap.data() as Partial<AllowlistDoc>);
        writeCachedAllowlist(key, allow);
        return allow;
      }
    } catch {
      // Ignore cache miss.
    }

    return cached;
  }
}

function cleanRoleValue(role: any) {
  return String(role || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function cleanTenantValue(tenantId: any) {
  return String(tenantId || "").trim();
}

function resolveAllowlistHomePath(user: User | null, allow: AllowlistDoc | null): string {
  const role = cleanRoleValue(allow?.role);
  const tenantId = cleanTenantValue(allow?.tenantId);

  if (!allow?.enabled) return "/login";
  if (role === "super_admin") return "/super";
  if (role === "ministry_super") return "/super";
  if (role === "super" || role === "governorate_super") return "/super-system";
  if (role === "exam_super") return tenantId && tenantId !== "default" ? `/t/${tenantId}/dashboard12` : "/dashboard12";
  if (role === "tenant_admin" || role === "admin") return tenantId && tenantId !== "default" ? `/t/${tenantId}` : "/";

  return resolveHomePath(
    buildAuthzSnapshot({
      user,
      profile: allow,
      tenantId: allow?.tenantId ?? null,
      isSuperAdmin: role === "super_admin",
      isSuper: role === "super" || role === "governorate_super",
    })
  );
}

function persistLoginContext(allow: AllowlistDoc | null, loginEmail?: string) {
  if (typeof window === "undefined" || !allow) return;

  const role = cleanRoleValue(allow.role);
  const rawTenantId = cleanTenantValue(allow.tenantId);
  const tenantId = role === "super_admin" || role === "ministry_super" || role === "super" ? "system" : rawTenantId;
  const email = normalizeLoginEmail(loginEmail || allow.email);

  const clearKeys = [
    "governorateSuperReadOnly",
    "viewAsReadOnly",
    "readOnly",
    "governorateSuperViewTenantId",
    "viewAsTenantId",
    "governorateSuperViewExpiresAt",
  ];

  for (const key of clearKeys) {
    try { window.sessionStorage.removeItem(key); } catch {}
    try { window.localStorage.removeItem(key); } catch {}
  }

  const pairs: Array<[string, string]> = [["loginRole", role], ["loginEmail", email]];
  if (tenantId) {
    pairs.push(["tenantId", tenantId]);
    pairs.push(["effectiveTenantId", tenantId]);
    pairs.push(["selectedTenantId", tenantId]);
    pairs.push(["lastTenantId", tenantId]);
  }

  for (const [key, value] of pairs) {
    try { window.localStorage.setItem(key, value); } catch {}
    try { window.sessionStorage.setItem(key, value); } catch {}
  }
}

function hardRedirectToAllowlistHome(user: User | null, allow: AllowlistDoc | null, loginEmail?: string) {
  const path = resolveAllowlistHomePath(user, allow);
  persistLoginContext(allow, loginEmail);
  if (typeof window !== "undefined") window.location.replace(path);
  return path;
}

function translateRoleLabel(label: string, lang: Lang): string {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "سوبر الوزارة": { ar: "سوبر الوزارة", en: "Ministry Super" },
    "سوبر المحافظات": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مشرف نطاق": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مدير جهة": { ar: "أدمن المدرسة", en: "School Admin" },
    "مدير": { ar: "أدمن المدرسة", en: "School Admin" },
    "سوبر الامتحانات": { ar: "سوبر الامتحانات", en: "Exam Super" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
    "مستخدم": { ar: "مستخدم", en: "User" },
  };
  return map[label]?.[lang] || label;
}

export default function Login() {
  const navigate = useNavigate();
  const { lang, setLang } = useI18n();
  const t = STR[lang as Lang] || STR.ar;

  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AllowlistDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const enabled = !!profile?.enabled;

  const authzSnapshot = useMemo(
    () =>
      buildAuthzSnapshot({
        user: fbUser,
        profile,
        tenantId: profile?.tenantId ?? null,
        isSuperAdmin: profile?.role === "super_admin",
        isSuper: profile?.role === "super",
      }),
    [fbUser, profile]
  );

  const roleBadgeBase = resolveRoleBadgeStyle(authzSnapshot);
  const roleBadge = {
    ...roleBadgeBase,
    label: translateRoleLabel(roleBadgeBase.label, lang as Lang),
  };

  const tenantId = profile?.tenantId ?? "";

  const isAllowed = useMemo(() => {
    const email = loginEmail || getFirebaseUserEmail(fbUser) || normalizeLoginEmail(profile?.email);
    if (!email) return false;
    return !!profile?.enabled;
  }, [fbUser, loginEmail, profile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      setError("");
      setProfile(null);

      let currentEmail = getFirebaseUserEmail(u);
      if (!currentEmail) currentEmail = await getTokenClaimEmail(u);
      if (currentEmail && u?.uid) writeStoredProviderEmail(u.uid, currentEmail);
      setLoginEmail(currentEmail);

      if (currentEmail) {
        const cached = readCachedAllowlist(currentEmail);
        if (cached) setProfile(cached);

        try {
          const allow = await fetchAllowlist(currentEmail);
          setProfile(allow || cached);
          if (!allow && !cached) setError(t.errGeneric);
        } catch {
          if (!cached) setError(t.errGeneric);
        }
      }
    });

    return () => unsub();
  }, [t.errGeneric]);

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    setProfile(null);
    setDebugLines([]);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const res = await signInWithPopup(auth, provider);
      const email = normalizeLoginEmail(res.user.email);
      setLoginEmail(email);

      if (!email) {
        setError(t.errGeneric);
        await signOut(auth);
        setBusy(false);
        return;
      }

      const cached = readCachedAllowlist(email);
      if (cached) setProfile(cached);

      const allow = await fetchAllowlist(email);
      setProfile(allow || cached);

      if (!DISABLE_FUNCTIONS) {
        try {
          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await res.user.getIdToken(true);
        } catch {
          // ignore
        }
      }

      const effectiveAllow = allow || cached;

      if (!effectiveAllow?.enabled) {
        setError(t.errNotAllowed);
      } else {
        navigate(resolveAllowlistHomePath(res.user, effectiveAllow), { replace: true });
      }
    } catch (e: any) {
      if (e?.code === "auth/popup-closed-by-user") {
        setError(t.errPopupClosed);
      } else {
        setError(t.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  };


  const buildMicrosoftDebugLines = async (result: UserCredential): Promise<string[]> => {
    const credential = OAuthProvider.credentialFromResult(result) as any;
    const profile = (getAdditionalUserInfo(result)?.profile || {}) as Record<string, any>;
    const tokenResponse = (result as any)?._tokenResponse || {};
    const rawUserInfo = safeJsonParse(tokenResponse.rawUserInfo) || {};
    const idTokenClaims = decodeJwtPayload(credential?.idToken || credential?.oauthIdToken || tokenResponse.oauthIdToken || tokenResponse.idToken);
    const graphEmail = await fetchMicrosoftGraphEmail(credential?.accessToken || credential?.oauthAccessToken || tokenResponse.oauthAccessToken || tokenResponse.accessToken);
    const candidates = collectEmailCandidates({ user: result.user, profile, tokenResponse, rawUserInfo, idTokenClaims, graphEmail });
    return [
      `firebase user.email: ${normalizeLoginEmail(result.user.email) || "—"}`,
      `providerData.email: ${normalizeLoginEmail(result.user.providerData?.find((p) => p?.email)?.email) || "—"}`,
      `profile email fields: ${getEmailFromObject(profile) || "—"}`,
      `rawUserInfo email fields: ${getEmailFromObject(rawUserInfo) || "—"}`,
      `idToken email fields: ${getEmailFromObject(idTokenClaims) || "—"}`,
      `Graph /me email: ${graphEmail || "—"}`,
      `all candidates: ${candidates.length ? candidates.join(" | ") : "—"}`,
      `firebase uid: ${result.user.uid || "—"}`,
    ];
  };

  const handleMicrosoft = async () => {
    setBusy(true);
    setError("");
    setProfile(null);
    setDebugLines([]);

    try {
      const provider = new OAuthProvider("microsoft.com");
      provider.addScope("openid");
      provider.addScope("email");
      provider.addScope("profile");
      // لا نطلب User.Read حتى لا تظهر شاشة موافقة المسؤول.
      // البريد سيُقرأ من ID Token claims: email / preferred_username / upn.
      provider.setCustomParameters({
        // مهم جدًا: تطبيق Microsoft داخل الوزارة Single-tenant،
        // لذلك يجب إجبار Firebase على استخدام tenant الوزارة بدل endpoint الافتراضي /common.
        // بدون هذا يظهر خطأ AADSTS50194: not configured as a multi-tenant application.
        tenant: "04b4cb5d-cc41-401f-bd9d-4ca8a31a5c2f",
        prompt: "select_account",
        domain_hint: "moe.om",
      });

      const res = await signInWithPopup(auth, provider);
      setDebugLines(await buildMicrosoftDebugLines(res));
      const email = await getMicrosoftLoginEmail(res);
      setLoginEmail(email);
      if (email) writeStoredProviderEmail(res.user.uid, email);

      if (!email) {
        setError(t.errMicrosoftEmailMissing);
        await signOut(auth);
        setBusy(false);
        return;
      }

      if (!isMoeEmail(email)) {
        setError(t.errMoeOnly);
        await signOut(auth);
        setBusy(false);
        return;
      }

      const cached = readCachedAllowlist(email);
      if (cached) setProfile(cached);

      const allow = await fetchAllowlist(email);
      setProfile(allow || cached);

      if (!DISABLE_FUNCTIONS) {
        try {
          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await res.user.getIdToken(true);
        } catch {
          // ignore
        }
      }

      const effectiveAllow = allow || cached;

      if (!effectiveAllow?.enabled) {
        setError(t.errNotAllowed);
      } else {
        hardRedirectToAllowlistHome(res.user, effectiveAllow, email);
      }
    } catch (e: any) {
      if (e?.code === "auth/popup-closed-by-user") {
        setError(t.errPopupClosed);
      } else {
        setError(t.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshPermissions = async () => {
    let currentEmail = loginEmail || getFirebaseUserEmail(fbUser);
    if (!currentEmail) currentEmail = await getTokenClaimEmail(fbUser);
    if (!fbUser || !currentEmail) return;
    setLoginEmail(currentEmail);

    setBusy(true);
    setError("");

    try {
      const cached = readCachedAllowlist(currentEmail);
      if (cached) setProfile(cached);

      const allow = await fetchAllowlist(currentEmail);
      setProfile(allow || cached);

      if (!DISABLE_FUNCTIONS) {
        try {
          try {
            const bootstrap = callFn<any, any>("bootstrapOwner");
            await bootstrap({});
          } catch {
            // ignore
          }

          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await fbUser.getIdToken(true);
        } catch {
          // ignore
        }
      }

      const effectiveAllow = allow || cached;

      if (effectiveAllow?.enabled) {
        navigate(resolveAllowlistHomePath(fbUser, effectiveAllow), { replace: true });
      }
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");

    try {
      await signOut(auth);
      setFbUser(null);
      setProfile(null);
      setLoginEmail("");
      setDebugLines([]);
    } finally {
      setBusy(false);
    }
  };

  const renderDeveloperWithHighlight = () => {
    if (lang === "ar") {
      const parts = t.developer.split("المطور");
      if (parts.length === 2) {
        return (
          <>
            <span
              style={{
                color: "#f6e05e",
                background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 900,
              }}
            >
              المطور
            </span>
            {parts[1]}
          </>
        );
      }
      return t.developer;
    }

    const parts = t.developer.split("Developer");
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span
            style={{
              color: "#f6e05e",
              background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 900,
            }}
          >
            Developer
          </span>
        </>
      );
    }
    return t.developer;
  };

  const renderSubtitleWithRedText = () => {
    if (lang === "ar") {
      const parts = t.subtitle.split("فقط");
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <span
              style={{
                color: "#f56565",
                fontWeight: 900,
                fontSize: "18px",
                marginInline: "4px",
              }}
            >
              فقط
            </span>
            {parts[1]}
          </>
        );
      }
      return t.subtitle;
    }

    const parts = t.subtitle.split("only");
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span
            style={{
              color: "#f56565",
              fontWeight: 900,
              fontSize: "18px",
              marginInline: "4px",
            }}
          >
            only
          </span>
          {parts[1]}
        </>
      );
    }
    return t.subtitle;
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top right, rgba(201, 162, 57, 0.18), transparent 34%), linear-gradient(135deg, #f8f1df 0%, #efe2bf 48%, #fbf7ed 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      direction: lang === "ar" ? "rtl" : "ltr",
      fontFamily: "'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#111827",
      position: "relative",
      overflow: "hidden",
    },
    backgroundPattern: {
      position: "absolute",
      inset: 0,
      background: `
        linear-gradient(90deg, rgba(151,116,28,0.10) 1px, transparent 1px),
        linear-gradient(180deg, rgba(151,116,28,0.08) 1px, transparent 1px)
      `,
      backgroundSize: "44px 44px",
      opacity: 0.35,
      zIndex: 0,
      pointerEvents: "none",
    },
    card: {
      width: "100%",
      maxWidth: "620px",
      borderRadius: "26px",
      background: "linear-gradient(180deg, rgba(255, 252, 244, 0.98), rgba(246, 237, 214, 0.98))",
      boxShadow: "0 24px 55px rgba(92, 64, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.86)",
      border: "2px solid rgba(180, 138, 24, 0.55)",
      padding: "42px 38px 34px",
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(10px)",
      zIndex: 1,
    },
    cardGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "7px",
      background: "linear-gradient(90deg, #8a6a00, #d4af37, #8a6a00)",
      borderRadius: "26px 26px 0 0",
      zIndex: 2,
    },
    header: {
      textAlign: "center",
      marginBottom: "30px",
    },
    logoContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: "18px",
    },
    logo: {
      width: "116px",
      height: "116px",
      borderRadius: "28px",
      background: "linear-gradient(180deg, #fffaf0, #ead9a8)",
      border: "2px solid rgba(180, 138, 24, 0.65)",
      padding: "12px",
      boxShadow: "0 14px 30px rgba(92, 64, 0, 0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    logoImage: {
      width: "100%",
      height: "100%",
      borderRadius: "18px",
      objectFit: "contain",
    },
    title: {
      fontSize: "30px",
      fontWeight: 1000,
      margin: "0 0 10px 0",
      color: "#111827",
      lineHeight: 1.35,
      letterSpacing: "-0.3px",
    },
    ministryText: {
      fontSize: "16px",
      color: "#4b5563",
      margin: "0 0 14px 0",
      fontWeight: 800,
      position: "relative",
      paddingBottom: "12px",
    },
    ministryUnderline: {
      position: "absolute",
      bottom: 0,
      left: "28%",
      right: "28%",
      height: "3px",
      background: "linear-gradient(90deg, transparent, #b8870b, transparent)",
      borderRadius: "999px",
    },
    subtitle: {
      fontSize: "15px",
      color: "#374151",
      margin: 0,
      fontWeight: 700,
      lineHeight: 1.6,
      padding: "0 10px",
    },
    googleBtn: {
      width: "100%",
      border: "2px solid rgba(138, 106, 0, 0.45)",
      borderRadius: "18px",
      padding: "17px 24px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: "18px",
      color: "#111827",
      background: "linear-gradient(180deg, #ffe9a6, #d4af37)",
      boxShadow: "0 12px 26px rgba(151, 116, 28, 0.24)",
      opacity: busy ? 0.72 : 1,
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
    },
    googleIcon: {
      fontSize: "24px",
      fontWeight: 1000,
      color: "#111827",
      background: "#ffffff",
      width: "34px",
      height: "34px",
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid rgba(138, 106, 0, 0.25)",
    },
    microsoftBtn: {
      width: "100%",
      marginTop: "14px",
      border: "2px solid rgba(59, 130, 246, 0.48)",
      borderRadius: "18px",
      padding: "17px 24px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: "18px",
      color: "#111827",
      background: "linear-gradient(180deg, #e0f2fe, #bfdbfe)",
      boxShadow: "0 12px 26px rgba(59, 130, 246, 0.18)",
      opacity: busy ? 0.72 : 1,
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
    },
    microsoftIcon: {
      width: "34px",
      height: "34px",
      borderRadius: "9px",
      background: "#ffffff",
      display: "inline-grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: "2px",
      padding: "5px",
      border: "1px solid rgba(37, 99, 235, 0.25)",
    },
    infoBox: {
      marginTop: "24px",
      borderRadius: "20px",
      padding: "22px",
      border: "1.5px solid rgba(180, 138, 24, 0.38)",
      background: "rgba(255, 255, 255, 0.62)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
      backdropFilter: "blur(5px)",
    },
    infoSection: {
      marginBottom: "20px",
    },
    infoRow: {
      display: "flex",
      alignItems: "flex-start",
      marginBottom: "14px",
      paddingBottom: "14px",
      borderBottom: "1px solid rgba(151, 116, 28, 0.18)",
      flexWrap: "wrap",
      gap: "8px",
    },
    infoLabel: {
      color: "#374151",
      fontSize: "14px",
      fontWeight: 800,
      minWidth: "110px",
      textAlign: lang === "ar" ? "right" : "left",
      marginBottom: "5px",
    },
    infoValue: {
      color: "#111827",
      fontSize: "14px",
      fontWeight: 800,
      flex: 1,
      wordBreak: "break-word",
    },
    badge: {
      padding: "7px 14px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: 900,
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      border: "1px solid rgba(255,255,255,0.55)",
    },
    badgeActive: {
      background: "linear-gradient(90deg, #15803d, #16a34a)",
      color: "#ffffff",
    },
    badgeInactive: {
      background: "linear-gradient(90deg, #991b1b, #dc2626)",
      color: "#ffffff",
    },
    hintText: {
      fontSize: "12px",
      color: "#7f1d1d",
      fontStyle: "normal",
      marginTop: "7px",
      fontWeight: 700,
      paddingLeft: lang === "ar" ? "0" : "110px",
      paddingRight: lang === "ar" ? "110px" : "0",
    },
    actions: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
    },
    actionBtn: {
      flex: 1,
      minWidth: "138px",
      borderRadius: "14px",
      padding: "13px 18px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: "14px",
      border: "none",
      transition: "all 0.2s ease",
      textAlign: "center",
    },
    primaryBtn: {
      background: "linear-gradient(180deg, #14532d, #166534)",
      color: "#ffffff",
      boxShadow: "0 8px 18px rgba(20, 83, 45, 0.22)",
    },
    secondaryBtn: {
      background: "linear-gradient(180deg, #fffaf0, #f0dfad)",
      color: "#111827",
      border: "1.5px solid rgba(151, 116, 28, 0.42)",
      boxShadow: "0 5px 14px rgba(92, 64, 0, 0.10)",
    },
    footer: {
      marginTop: "32px",
      textAlign: "center",
      borderTop: "1px solid rgba(151, 116, 28, 0.22)",
      paddingTop: "20px",
    },
    copyright: {
      fontSize: "14px",
      color: "#4b5563",
      margin: "0 0 10px 0",
      fontWeight: 700,
    },
    developerInfo: {
      fontSize: "14px",
      color: "#111827",
      margin: "8px 0",
      lineHeight: 1.6,
      fontWeight: 700,
    },
    teacherName: {
      fontWeight: 1000,
      color: "#8a6a00",
      fontSize: "15px",
    },
    error: {
      marginTop: "18px",
      padding: "14px",
      borderRadius: "14px",
      background: "#fff1f2",
      border: "1.5px solid rgba(190, 18, 60, 0.28)",
      color: "#7f1d1d",
      fontSize: "13px",
      textAlign: "center",
      fontWeight: 800,
    },
    langSwitch: {
      position: "absolute",
      top: "24px",
      [lang === "ar" ? "left" : "right"]: "24px",
      background: "linear-gradient(180deg, #fffaf0, #ead9a8)",
      border: "1.5px solid rgba(151, 116, 28, 0.42)",
      color: "#111827",
      padding: "10px 20px",
      borderRadius: "999px",
      fontSize: "14px",
      fontWeight: 900,
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 8px 18px rgba(92, 64, 0, 0.12)",
      zIndex: 3,
    },
    loading: {
      display: "inline-block",
      width: "22px",
      height: "22px",
      border: "3px solid rgba(17, 24, 39, 0.20)",
      borderTop: "3px solid #111827",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundPattern}></div>

      <button
        style={styles.langSwitch}
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      >
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div style={styles.card}>
        <div style={styles.cardGlow}></div>

        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <div style={styles.logo}>
              <img
                src="https://i.imgur.com/vdDhSMh.png"
                alt="شعار النظام"
                style={styles.logoImage}
              />
            </div>
          </div>

          <h1 style={styles.title}>{t.title}</h1>

          <div style={styles.ministryText}>
            {t.ministry}
            <div style={styles.ministryUnderline}></div>
          </div>

          <p style={styles.subtitle}>{renderSubtitleWithRedText()}</p>
        </div>

        <button style={styles.googleBtn} onClick={handleGoogle} disabled={busy}>
          {busy ? (
            <span style={styles.loading}></span>
          ) : (
            <>
              <span style={styles.googleIcon}>G</span>
              {t.signIn}
            </>
          )}
        </button>

        <button style={styles.microsoftBtn} onClick={handleMicrosoft} disabled={busy}>
          {busy ? (
            <span style={styles.loading}></span>
          ) : (
            <>
              <span style={styles.microsoftIcon} aria-hidden="true">
                <span style={{ background: "#f25022" }}></span>
                <span style={{ background: "#7fba00" }}></span>
                <span style={{ background: "#00a4ef" }}></span>
                <span style={{ background: "#ffb900" }}></span>
              </span>
              {t.microsoftSignIn}
            </>
          )}
        </button>

        {(fbUser || error || profile) && (
          <div style={styles.infoBox}>
            <div style={styles.infoSection}>
              {(loginEmail || fbUser?.email) && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>{t.signedInAs}</div>
                  <div style={styles.infoValue}>{loginEmail || fbUser?.email}</div>
                </div>
              )}

              <div style={styles.infoRow}>
                <div style={styles.infoLabel}>{t.status}</div>
                <div>
                  <span
                    style={{
                      ...styles.badge,
                      ...(enabled ? styles.badgeActive : styles.badgeInactive),
                    }}
                  >
                    {enabled ? t.active : t.inactive}
                  </span>

                  {!enabled && <div style={styles.hintText}>{t.inactiveHint}</div>}
                </div>
              </div>

              {tenantId && tenantId !== "default" && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>{t.tenant}</div>
                  <div style={styles.infoValue}>{tenantId}</div>
                </div>
              )}

              {profile?.role && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>{t.role}</div>
                  <div style={styles.infoValue}>{roleBadge.label}</div>
                </div>
              )}
              {debugLines.length > 0 && (
                <div style={styles.infoRow}>
                  <div style={styles.infoLabel}>Microsoft Debug</div>
                  <div style={styles.infoValue}>
                    {debugLines.map((line, index) => (
                      <div key={index} style={{ fontSize: "12px", direction: "ltr", textAlign: "left", marginBottom: "4px" }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={styles.actions}>
              {fbUser && (
                <>
                  <button
                    style={{ ...styles.actionBtn, ...styles.secondaryBtn }}
                    onClick={refreshPermissions}
                    disabled={busy}
                  >
                    {t.refresh}
                  </button>

                  <button
                    style={{ ...styles.actionBtn, ...styles.secondaryBtn }}
                    onClick={logout}
                    disabled={busy}
                  >
                    {t.logout}
                  </button>

                  {isAllowed && (
                    <button
                      style={{ ...styles.actionBtn, ...styles.primaryBtn }}
                      onClick={() =>
                        navigate(resolveAllowlistHomePath(fbUser, profile), {
                          replace: true,
                        })
                      }
                      disabled={busy}
                    >
                      {t.okGo}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.footer}>
          <div style={styles.copyright}>{t.footer}</div>
          <div style={styles.developerInfo}>
            <div>{renderDeveloperWithHighlight()}</div>
            <div>
              {t.teacher.split(":")[0]}:{" "}
              <span style={styles.teacherName}>{t.teacher.split(":")[1]}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        * {
          box-sizing: border-box;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        img {
          max-width: 100%;
        }

        #root {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
