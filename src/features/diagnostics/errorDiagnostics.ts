// src/features/diagnostics/errorDiagnostics.ts
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase/firebase";

export type SystemErrorLevel = "error" | "warning" | "info";

export type SystemErrorLogEntry = {
  id: string;
  at: string;
  level: SystemErrorLevel;
  message: string;
  source?: string;
  stack?: string;
  path?: string;
  userEmail?: string;
  role?: string;
  governorate?: string;
  tenantId?: string;
  readOnly?: boolean;
  userAgent?: string;
};

const LOCAL_KEY = "exam-manager:system-error-logs:v1";
const CLOUD_ENABLED_KEY = "exam-manager:system-error-log-cloud-enabled";
const MAX_LOCAL = 250;

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function isCloudErrorLogEnabled() {
  if (!canUseStorage()) return true;
  const raw = window.localStorage.getItem(CLOUD_ENABLED_KEY);
  if (raw === "0" || raw === "false") return false;
  return true;
}

export function setCloudErrorLogEnabled(enabled: boolean) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(CLOUD_ENABLED_KEY, enabled ? "1" : "0");
}

export function readLocalSystemErrors(): SystemErrorLogEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeLocalSystemErrors(rows: SystemErrorLogEntry[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, MAX_LOCAL)));
  } catch {
    // ignore storage quota errors
  }
}

export function clearLocalSystemErrors() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // ignore
  }
}

function shouldIgnoreMessage(message: string) {
  const text = String(message || "").toLowerCase();
  if (!text.trim()) return true;
  if (text.includes("download the react devtools")) return true;
  if (text.includes("devtools is now available")) return true;
  if (text.includes("google chrome devtools")) return true;
  if (text.includes("systemerrorlogs") && text.includes("permission")) return true;
  return false;
}

function fingerprint(entry: Pick<SystemErrorLogEntry, "level" | "message" | "source" | "path">) {
  return [entry.level, entry.source || "", entry.path || "", String(entry.message || "").slice(0, 220)].join("|");
}

function recentlyRecorded(fp: string) {
  if (!canUseStorage()) return false;
  const key = `exam-manager:system-error-fp:${fp}`;
  const last = Number(window.sessionStorage.getItem(key) || 0);
  if (Number.isFinite(last) && Date.now() - last < 30000) return true;
  try {
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore
  }
  return false;
}

export async function recordSystemError(input: Partial<SystemErrorLogEntry>) {
  const message = String(input.message || "").trim();
  const level = (input.level || "error") as SystemErrorLevel;
  const source = String(input.source || "browser");
  const path = typeof window !== "undefined" ? window.location.pathname : input.path || "";

  if (shouldIgnoreMessage(message)) return;

  const fp = fingerprint({ level, message, source, path });
  if (recentlyRecorded(fp)) return;

  const entry: SystemErrorLogEntry = {
    id: input.id || nowId(),
    at: input.at || new Date().toISOString(),
    level,
    message,
    source,
    stack: input.stack ? String(input.stack).slice(0, 3000) : "",
    path,
    userEmail: input.userEmail || "",
    role: input.role || "",
    governorate: input.governorate || "",
    tenantId: input.tenantId || "",
    readOnly: Boolean(input.readOnly),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  const current = readLocalSystemErrors();
  writeLocalSystemErrors([entry, ...current].slice(0, MAX_LOCAL));

  if (!isCloudErrorLogEnabled()) return;

  try {
    await addDoc(collection(db, "systemErrorLogs"), {
      ...entry,
      createdAtMs: Date.now(),
    });
  } catch {
    // لا نسجل فشل تسجيل الخطأ حتى لا ندخل في حلقة أخطاء.
  }
}
