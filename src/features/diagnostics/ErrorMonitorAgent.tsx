// src/features/diagnostics/ErrorMonitorAgent.tsx
import { useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { recordSystemError } from "./errorDiagnostics";

function pickProfileValue(profile: any, keys: string[]) {
  for (const key of keys) {
    const value = profile?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeError(value: any) {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack || "" };
  }
  if (value?.message) {
    return { message: String(value.message), stack: String(value.stack || "") };
  }
  return { message: String(value || "خطأ غير معروف"), stack: "" };
}

export default function ErrorMonitorAgent() {
  const auth = useAuth() as any;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const profile = auth?.profile || auth?.userProfile || auth?.allow || {};
    const userEmail = String(auth?.user?.email || profile?.email || "").trim();
    const role = pickProfileValue(profile, ["role", "effectiveRole", "type"]);
    const governorate = pickProfileValue(profile, ["governorate", "tenantGovernorate", "regionAr"]);
    const tenantId = pickProfileValue(profile, ["tenantId", "effectiveTenantId", "selectedTenantId"]);
    const readOnly = Boolean(auth?.readOnly || auth?.allow?.readOnly || profile?.readOnly);

    const baseMeta = { userEmail, role, governorate, tenantId, readOnly };

    const onError = (event: ErrorEvent) => {
      const normalized = normalizeError(event.error || event.message);
      void recordSystemError({
        ...baseMeta,
        level: "error",
        source: event.filename ? `window.onerror:${event.filename}:${event.lineno || ""}` : "window.onerror",
        message: normalized.message,
        stack: normalized.stack,
      });
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const normalized = normalizeError(event.reason);
      void recordSystemError({
        ...baseMeta,
        level: "error",
        source: "unhandledrejection",
        message: normalized.message,
        stack: normalized.stack,
      });
    };

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      const text = args.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : "")).filter(Boolean).join(" ").trim();
      if (/maximum update depth|firebaseerror|permission|failed to load|uncaught|rangeerror|typeerror/i.test(text)) {
        void recordSystemError({ ...baseMeta, level: "error", source: "console.error", message: text.slice(0, 1200) });
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      const text = args.map((x) => (typeof x === "string" ? x : "")).filter(Boolean).join(" ").trim();
      if (/cloudlocalstorage|permission|firebaseerror|failed/i.test(text)) {
        void recordSystemError({ ...baseMeta, level: "warning", source: "console.warn", message: text.slice(0, 1200) });
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [auth?.user?.email, auth?.profile, auth?.userProfile, auth?.allow, auth?.readOnly]);

  return null;
}
