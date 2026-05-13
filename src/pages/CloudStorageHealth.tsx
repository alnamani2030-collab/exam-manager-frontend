import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";

type TestStatus = "pass" | "fail" | "skip" | "wait";

type HealthTest = {
  id: string;
  title: string;
  status: TestStatus;
  details: string;
  code?: string;
  path?: string;
  suggestion?: string;
};

type AuthLike = {
  readOnly?: boolean;
  allow?: { readOnly?: boolean };
  profile?: { readOnly?: boolean };
  userProfile?: { readOnly?: boolean };
};

const GOLD = "#b58b16";
const GOLD_SOFT = "rgba(181, 139, 22, 0.34)";
const DARK = "#111827";
const MUTED = "#4b5563";
const BEIGE = "#f7efe0";
const CARD = "rgba(255, 252, 242, 0.96)";
const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

function getStorageValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function isReadOnlyViewForTenant(tenantId: string): boolean {
  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return false;

  const flags = [
    getStorageValue("governorateSuperReadOnly"),
    getStorageValue("viewAsReadOnly"),
    getStorageValue("readOnly"),
  ].some((value) => ["1", "true", "yes"].includes(value.toLowerCase()));

  if (!flags) return false;

  const expiresAt = Number(getStorageValue("governorateSuperViewExpiresAt") || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) return false;

  return [
    getStorageValue("governorateSuperViewTenantId"),
    getStorageValue("viewAsTenantId"),
    getStorageValue("effectiveTenantId"),
    getStorageValue("selectedTenantId"),
    getStorageValue("tenantId"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .includes(targetTenantId);
}

function errorMessage(error: unknown) {
  const anyError = error as { code?: unknown; message?: unknown };
  const code = String(anyError?.code || "").trim();
  const message = String(anyError?.message || error || "").trim();
  return code ? `${code}: ${message}` : message || "Unknown error";
}

type IssueInfo = {
  code: string;
  details: string;
  suggestion: string;
};

function classifyIssue(error: unknown, lang: "ar" | "en"): IssueInfo {
  const raw = errorMessage(error);
  const lower = raw.toLowerCase();

  if (lower.includes("permission-denied") || lower.includes("missing or insufficient permissions")) {
    return {
      code: "PERMISSION",
      details: raw,
      suggestion:
        lang === "ar"
          ? "راجع صلاحيات المستخدم وقواعد Firestore لهذا المركز. إذا كان الدخول مشاهدة فقط فهذا السلوك طبيعي لاختبار الكتابة."
          : "Check the user permissions and Firestore rules for this tenant. If the tenant is opened read-only, write restrictions are expected.",
    };
  }

  if (lower.includes("unavailable") || lower.includes("network") || lower.includes("offline") || lower.includes("deadline-exceeded")) {
    return {
      code: "NETWORK",
      details: raw,
      suggestion:
        lang === "ar"
          ? "تحقق من الاتصال بالإنترنت وحالة Firebase ثم أعد الفحص."
          : "Check the internet connection and Firebase availability, then run the check again.",
    };
  }

  if (lower.includes("not-found") || lower.includes("document does not exist")) {
    return {
      code: "NOT_FOUND",
      details: raw,
      suggestion:
        lang === "ar"
          ? "المسار قابل للوصول لكن الوثيقة غير موجودة. تأكد من إنشاء إعدادات المركز أو صحة tenantId."
          : "The path is reachable but the document is missing. Check tenant config creation or the tenantId.",
    };
  }

  return {
    code: "UNKNOWN",
    details: raw,
    suggestion:
      lang === "ar"
        ? "راجع رسالة الخطأ الفنية أو انسخ تقرير الفحص للدعم."
        : "Review the technical error message or copy the diagnostic report for support.",
  };
}

function sanitizeForReport(value: string, tenantId: string) {
  const safeTenantId = String(tenantId || "").trim();
  let text = String(value || "").trim();
  if (safeTenantId) text = text.split(safeTenantId).join("[tenantId]");
  return text.length > 700 ? `${text.slice(0, 700)}...` : text;
}

function firestorePathLabel(path: string, lang: "ar" | "en") {
  return lang === "ar" ? `المسار: ${path}` : `Path: ${path}`;
}

function statusLabel(status: TestStatus, lang: "ar" | "en") {
  if (lang === "ar") {
    return status === "pass" ? "ناجح" : status === "fail" ? "فشل" : status === "skip" ? "تم التجاوز" : "جاري الفحص";
  }
  return status === "pass" ? "Passed" : status === "fail" ? "Failed" : status === "skip" ? "Skipped" : "Checking";
}

function statusColor(status: TestStatus) {
  if (status === "pass") return "#166534";
  if (status === "fail") return "#991b1b";
  if (status === "skip") return "#854d0e";
  return "#374151";
}

function codeColor(code?: string) {
  if (!code) return "#374151";
  if (["OK", "READ_ONLY", "CACHE_CLEARED"].includes(code)) return "#166534";
  if (["PERMISSION", "NO_TENANT"].includes(code)) return "#991b1b";
  if (["NETWORK", "NOT_FOUND"].includes(code)) return "#854d0e";
  return "#374151";
}

function readLocalStorageSummary() {
  if (typeof window === "undefined") return { total: 0, synced: 0, cache: 0 };
  let total = 0;
  let synced = 0;
  let cache = 0;

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) || "";
      total += 1;
      if (key.includes("cloud-cache") || key.includes(":cache:")) cache += 1;
      if (
        key.startsWith("exam-manager:") ||
        key.startsWith("school-exam-manager:") ||
        key.startsWith("task-distribution:") ||
        key.includes("examRoomAssignments")
      ) {
        synced += 1;
      }
    }
  } catch {
    // ignore
  }

  return { total, synced, cache };
}

export default function CloudStorageHealth() {
  const navigate = useNavigate();
  const { tenantId } = useParams();
  const auth = useAuth() as AuthLike;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const tid = String(tenantId || "").trim();
  const readOnly = useMemo(() => {
    return Boolean(
      auth?.readOnly ||
        auth?.allow?.readOnly ||
        auth?.profile?.readOnly ||
        auth?.userProfile?.readOnly ||
        isReadOnlyViewForTenant(tid)
    );
  }, [auth, tid]);

  const [running, setRunning] = useState(false);
  const [tests, setTests] = useState<HealthTest[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");
  const localSummary = useMemo(() => readLocalStorageSummary(), [lastCheckedAt, actionMessage]);


  function clearInternalCloudCache(confirmAction = true) {
    if (typeof window === "undefined") return;

    if (
      confirmAction &&
      !window.confirm(
        tr(
          "سيتم تنظيف كاش التخزين السحابي فقط، ولن يتم حذف بيانات البرنامج. هل تريد المتابعة؟",
          "Only internal cloud-storage cache will be cleared. App data will not be deleted. Continue?"
        )
      )
    ) {
      return;
    }

    let removed = 0;
    const keys: string[] = [];

    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i) || "";
        if (
          key.includes("cloud-cache") ||
          key.includes("cloud-storage:last-error") ||
          key.includes("cloud-storage:last-warning") ||
          key.includes("cloudLocalStorage:pending")
        ) {
          keys.push(key);
        }
      }

      keys.forEach((key) => {
        window.localStorage.removeItem(key);
        removed += 1;
      });

      window.dispatchEvent(new Event("exam-manager:cloud-storage:changed"));
      setLastCheckedAt(new Date().toLocaleString(lang === "ar" ? "ar" : "en"));
      setActionMessage(
        tr(
          `تم تنظيف ${removed} مفتاح كاش داخلي بدون حذف بيانات البرنامج.`,
          `Cleared ${removed} internal cache key(s) without deleting app data.`
        )
      );
    } catch (error) {
      setActionMessage(tr(`تعذر تنظيف الكاش: ${errorMessage(error)}`, `Could not clear cache: ${errorMessage(error)}`));
    }
  }

  function forceReloadFromCloud() {
    clearInternalCloudCache(false);
    setActionMessage(tr("تم تنظيف الكاش وسيتم تحديث الصفحة الآن لجلب أحدث بيانات من السحابة.", "Cache cleared. The page will refresh to load the latest cloud data."));
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function copyDiagnosticReport() {
    const report = {
      tenantId: tid,
      readOnly,
      lastCheckedAt,
      localStorage: readLocalStorageSummary(),
      tests: tests.map((test) => ({
        id: test.id,
        title: test.title,
        status: test.status,
        code: test.code || "",
        path: test.path || "",
        details: sanitizeForReport(test.details, tid),
        suggestion: sanitizeForReport(test.suggestion || "", tid),
      })),
      generatedAt: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setActionMessage(tr("تم نسخ تقرير الفحص. أرسله عند ظهور أي مشكلة.", "Diagnostic report copied. Share it when an issue appears."));
    } catch {
      setActionMessage(tr("تعذر النسخ التلقائي. يمكنك استخدام نتائج الفحص الظاهرة في الصفحة.", "Automatic copy failed. You can use the visible check results."));
    }
  }

  async function runHealthCheck() {
    setRunning(true);
    setActionMessage("");

    const nowLabel = () => new Date().toLocaleString(lang === "ar" ? "ar" : "en");

    if (!tid) {
      setTests([
        {
          id: "tenant",
          title: tr("فحص نطاق المركز", "Tenant scope check"),
          status: "fail",
          details: tr(
            "لا يوجد tenantId في رابط الصفحة، لذلك لا يمكن تشغيل فحص التخزين السحابي.",
            "No tenantId was found in the page URL, so the cloud-storage health check cannot run."
          ),
          code: "NO_TENANT",
          suggestion: tr(
            "افتح الصفحة من داخل المركز أو تأكد أن الرابط يحتوي على نطاق المركز الصحيح.",
            "Open this page from inside the tenant or make sure the URL includes the correct tenant scope."
          ),
        },
      ]);
      setLastCheckedAt(nowLabel());
      setRunning(false);
      return;
    }

    setTests([
      { id: "tenant", title: tr("فحص نطاق المركز", "Tenant scope check"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "local", title: tr("فحص التخزين المحلي", "Local storage check"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "config", title: tr("قراءة إعدادات المركز", "Read tenant config"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "cloudLocalStorageRead", title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "cloudLocalStorageWrite", title: tr("اختبار الكتابة السحابية", "Cloud write test"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
    ]);

    const next: HealthTest[] = [];

    try {
      next.push({
        id: "tenant",
        title: tr("فحص نطاق المركز", "Tenant scope check"),
        status: "pass",
        details: tr(`نطاق المركز الحالي: ${tid}`, `Current tenant scope: ${tid}`),
        code: "OK",
      });

      try {
        const summary = readLocalStorageSummary();
        next.push({
          id: "local",
          title: tr("فحص التخزين المحلي", "Local storage check"),
          status: "pass",
          details: tr(
            `المفاتيح المحلية: ${summary.total} — مفاتيح البرنامج: ${summary.synced} — كاش داخلي: ${summary.cache}`,
            `Local keys: ${summary.total} — app keys: ${summary.synced} — internal cache: ${summary.cache}`
          ),
          code: "OK",
        });
      } catch (error) {
        const issue = classifyIssue(error, lang);
        next.push({ id: "local", title: tr("فحص التخزين المحلي", "Local storage check"), status: "fail", details: issue.details, code: issue.code, suggestion: issue.suggestion });
      }

      try {
        const snap = await getDoc(doc(db, "tenants", tid, "meta", "config"));
        next.push({
          id: "config",
          title: tr("قراءة إعدادات المركز", "Read tenant config"),
          status: "pass",
          details: snap.exists()
            ? tr("تمت قراءة إعدادات المركز بنجاح.", "Tenant config was read successfully.")
            : tr("تم الوصول للمسار، لكن وثيقة الإعدادات غير موجودة بعد.", "Path is readable, but the config document does not exist yet."),
          code: snap.exists() ? "OK" : "MISSING_CONFIG",
          path: `tenants/${tid}/meta/config`,
          suggestion: snap.exists()
            ? undefined
            : tr("إذا كانت هذه مدرسة/مركز جديد، تأكد من إنشاء وثيقة إعدادات المركز.", "If this is a new tenant, make sure the tenant config document is created."),
        });
      } catch (error) {
        const issue = classifyIssue(error, lang);
        next.push({
          id: "config",
          title: tr("قراءة إعدادات المركز", "Read tenant config"),
          status: "fail",
          details: issue.details,
          code: issue.code,
          path: `tenants/${tid}/meta/config`,
          suggestion: issue.suggestion,
        });
      }

      try {
        await getDocs(query(collection(db, "tenants", tid, "cloudLocalStorage"), limit(1)));
        next.push({
          id: "cloudLocalStorageRead",
          title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"),
          status: "pass",
          details: tr("تمت قراءة مسار cloudLocalStorage بنجاح.", "cloudLocalStorage path was read successfully."),
          code: "OK",
          path: `tenants/${tid}/cloudLocalStorage`,
        });
      } catch (error) {
        const issue = classifyIssue(error, lang);
        next.push({
          id: "cloudLocalStorageRead",
          title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"),
          status: "fail",
          details: issue.details,
          code: issue.code,
          path: `tenants/${tid}/cloudLocalStorage`,
          suggestion: issue.suggestion,
        });
      }

      if (readOnly) {
        next.push({
          id: "cloudLocalStorageWrite",
          title: tr("اختبار الكتابة السحابية", "Cloud write test"),
          status: "skip",
          details: tr("تم تجاوز اختبار الكتابة لأنك داخل المركز بوضع مشاهدة فقط.", "Write test skipped because this tenant is opened in read-only mode."),
          code: "READ_ONLY",
          path: `tenants/${tid}/cloudLocalStorage`,
          suggestion: tr("لا يوجد خطأ هنا. وضع المشاهدة فقط يمنع الكتابة بشكل طبيعي.", "This is not an error. Read-only mode should block writes."),
        });
      } else {
        const healthRef = doc(db, "tenants", tid, "cloudLocalStorage", `health-check-${Date.now()}`);
        try {
          await setDoc(
            healthRef,
            {
              key: "health-check",
              value: "ok",
              tenantId: tid,
              source: "CloudStorageHealth",
              updatedAt: serverTimestamp(),
              updatedAtMs: Date.now(),
            },
            { merge: true }
          );
          await deleteDoc(healthRef);
          next.push({
            id: "cloudLocalStorageWrite",
            title: tr("اختبار الكتابة السحابية", "Cloud write test"),
            status: "pass",
            details: tr("تم اختبار الكتابة والحذف بنجاح.", "Write and delete test passed."),
            code: "OK",
            path: `tenants/${tid}/cloudLocalStorage/health-check-*`,
          });
        } catch (error) {
          const issue = classifyIssue(error, lang);
          next.push({
            id: "cloudLocalStorageWrite",
            title: tr("اختبار الكتابة السحابية", "Cloud write test"),
            status: "fail",
            details: issue.details,
            code: issue.code,
            path: `tenants/${tid}/cloudLocalStorage/health-check-*`,
            suggestion: issue.suggestion,
          });
        }
      }

      setTests(next);
      setLastCheckedAt(nowLabel());
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void runHealthCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, readOnly, lang]);

  const failedCount = tests.filter((test) => test.status === "fail").length;
  const passedCount = tests.filter((test) => test.status === "pass").length;
  const skippedCount = tests.filter((test) => test.status === "skip").length;
  const overallStatus = failedCount > 0 ? "fail" : running ? "wait" : tests.length ? "pass" : "wait";
  const visibleSuggestions = tests.filter((test) => test.suggestion && (test.status === "fail" || test.status === "skip"));

  return (
    <main
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        padding: 22,
        background: `linear-gradient(180deg, ${BEIGE} 0%, #fffaf0 50%, #f2e3bd 100%)`,
        color: DARK,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          border: `1.5px solid ${GOLD}`,
          borderRadius: 20,
          background: CARD,
          padding: 22,
          boxShadow: "0 10px 28px rgba(100, 75, 15, 0.12)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              border: `1.5px solid ${GOLD}`,
              background: "#fffaf0",
              color: DARK,
              padding: "10px 16px",
              borderRadius: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {tr("العودة", "Back")}
          </button>

          <div style={{ textAlign: "center", flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: DARK }}>
              {tr("فحص التخزين السحابي", "Cloud Storage Health Check")}
            </h1>
            <p style={{ margin: "12px 0 0", fontWeight: 700, color: "#6b4e09" }}>
              {tr("فحص القراءة والكتابة والمشاهدة فقط داخل نطاق المركز الحالي", "Check read, write, and read-only status for the current tenant")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "center" }}>
               <div style={{ fontWeight: 900, color: "#6b4e09" }}>{tr("سلطنة عمان", "Sultanate of Oman")}</div>
              <div style={{ fontWeight: 900, color: "#6b4e09" }}>{tr("وزارة التربية والتعليم", "Ministry of Education")}</div>
              <div style={{ fontWeight: 700 }}>{tid || tr("لا يوجد نطاق", "No tenant")}</div>
            </div>
            <img
              src={LOGO_URL}
              alt="logo"
              style={{ width: 82, height: 82, objectFit: "contain", border: `1.5px solid ${GOLD}`, borderRadius: 14, background: "#fffaf0", padding: 8 }}
            />
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("النتائج الناجحة", "Passed")}</div>
          <div style={numberStyle("#166534")}>{passedCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("الأخطاء", "Failed")}</div>
          <div style={numberStyle("#991b1b")}>{failedCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("تم التجاوز", "Skipped")}</div>
          <div style={numberStyle("#854d0e")}>{skippedCount}</div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("وضع الدخول", "Access mode")}</div>
          <div style={{ fontWeight: 900, color: readOnly ? "#854d0e" : "#166534", fontSize: 22 }}>
            {readOnly ? tr("مشاهدة فقط", "Read-only") : tr("تشغيل وتعديل", "Read & write")}
          </div>
        </div>
        <div style={cardStyle()}>
          <div style={labelStyle()}>{tr("آخر فحص", "Last check")}</div>
          <div style={{ fontWeight: 900 }}>{lastCheckedAt || "—"}</div>
        </div>
      </section>

      <section style={panelStyle()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, color: "#6b4e09", fontSize: 26 }}>{tr("نتيجة الفحص", "Check results")}</h2>
            <p style={{ margin: "6px 0 0", color: MUTED, fontWeight: 700 }}>
              {tr("هذه الصفحة لا تغير بيانات البرنامج، باستثناء اختبار مؤقت يتم حذفه مباشرة.", "This page does not change app data except a temporary test document that is deleted immediately.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={running}
              style={actionButtonStyle(running ? "#9ca3af" : GOLD, running)}
            >
              {running ? tr("جاري الفحص...", "Checking...") : tr("إعادة الفحص", "Run again")}
            </button>
            <button type="button" onClick={() => clearInternalCloudCache(true)} style={actionButtonStyle("#2563eb", false)}>
              {tr("تنظيف الكاش", "Clear cache")}
            </button>
            <button type="button" onClick={forceReloadFromCloud} style={actionButtonStyle("#166534", false)}>
              {tr("تحديث من السحابة", "Reload from cloud")}
            </button>
            <button type="button" onClick={() => void copyDiagnosticReport()} style={actionButtonStyle("#374151", false)}>
              {tr("نسخ تقرير الفحص", "Copy report")}
            </button>
          </div>
        </div>

        <div
          style={{
            marginBottom: 14,
            padding: "12px 16px",
            borderRadius: 14,
            border: `1.5px solid ${statusColor(overallStatus)}`,
            background: overallStatus === "fail" ? "#fef2f2" : overallStatus === "pass" ? "#f0fdf4" : "#f9fafb",
            color: statusColor(overallStatus),
            fontWeight: 900,
          }}
        >
          {overallStatus === "fail"
            ? tr("يوجد خلل يحتاج مراجعة قبل اعتماد التخزين السحابي.", "There is an issue that needs review before relying on cloud storage.")
            : overallStatus === "pass"
              ? tr("التخزين السحابي يعمل بشكل سليم حسب الفحوصات الحالية.", "Cloud storage is healthy according to the current checks.")
              : tr("جاري تجهيز نتيجة الفحص.", "Preparing check result.")}
        </div>

        {actionMessage ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(37, 99, 235, 0.35)",
              background: "#eff6ff",
              color: "#1e3a8a",
              fontWeight: 700,
            }}
          >
            {actionMessage}
          </div>
        ) : null}

        {!tid ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1.5px solid rgba(153, 27, 27, 0.35)",
              background: "#fef2f2",
              color: "#7f1d1d",
              fontWeight: 800,
            }}
          >
            {tr("لا يمكن تشغيل الفحص لأن رابط الصفحة لا يحتوي على نطاق المركز.", "The check cannot run because the page URL does not include a tenant scope.")}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          {tests.map((test) => (
            <article key={test.id} style={{ ...rowStyle(), borderColor: statusColor(test.status) }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, color: DARK }}>{test.title}</h3>
                <p style={{ margin: "8px 0 0", color: MUTED, fontWeight: 700, lineHeight: 1.8 }}>{test.details}</p>
                {test.path ? <p style={{ margin: "6px 0 0", color: "#6b4e09", fontWeight: 800 }}>{firestorePathLabel(test.path, lang)}</p> : null}
                {test.suggestion ? <p style={{ margin: "6px 0 0", color: codeColor(test.code), fontWeight: 800, lineHeight: 1.7 }}>{test.suggestion}</p> : null}
              </div>
              <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                {test.code ? (
                  <span
                    style={{
                      border: `1px solid ${codeColor(test.code)}`,
                      color: codeColor(test.code),
                      background: "#fffaf0",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: 0.2,
                    }}
                  >
                    {test.code}
                  </span>
                ) : null}
              <strong
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 110,
                  borderRadius: 999,
                  padding: "8px 14px",
                  color: "white",
                  background: statusColor(test.status),
                }}
              >
                {statusLabel(test.status, lang)}
              </strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      {visibleSuggestions.length ? (
        <section style={{ ...panelStyle(), marginTop: 20 }}>
          <h2 style={{ marginTop: 0, color: "#6b4e09" }}>{tr("إجراءات مقترحة", "Recommended actions")}</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleSuggestions.map((test) => (
              <div key={`suggestion-${test.id}`} style={miniBoxStyle()}>
                <strong style={{ color: codeColor(test.code), display: "block", marginBottom: 6 }}>{test.title}</strong>
                <span>{test.suggestion}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ ...panelStyle(), marginTop: 20 }}>
        <h2 style={{ marginTop: 0, color: "#6b4e09" }}>{tr("ملخص التخزين المحلي", "Local storage summary")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={miniBoxStyle()}>{tr(`كل المفاتيح: ${localSummary.total}`, `All keys: ${localSummary.total}`)}</div>
          <div style={miniBoxStyle()}>{tr(`مفاتيح البرنامج: ${localSummary.synced}`, `App keys: ${localSummary.synced}`)}</div>
          <div style={miniBoxStyle()}>{tr(`الكاش الداخلي: ${localSummary.cache}`, `Internal cache: ${localSummary.cache}`)}</div>
        </div>
      </section>
    </main>
  );
}

function actionButtonStyle(background: string, disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    background,
    color: "white",
    padding: "11px 15px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: disabled ? "default" : "pointer",
    boxShadow: "0 5px 14px rgba(31, 41, 55, 0.12)",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    background: CARD,
    border: `1.5px solid ${GOLD_SOFT}`,
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 6px 18px rgba(100, 75, 15, 0.08)",
  };
}

function labelStyle(): React.CSSProperties {
  return { color: "#6b4e09", fontWeight: 700, marginBottom: 8 };
}

function numberStyle(color: string): React.CSSProperties {
  return { color, fontSize: 38, fontWeight: 900, lineHeight: 1 };
}

function panelStyle(): React.CSSProperties {
  return {
    background: CARD,
    border: `1.5px solid ${GOLD_SOFT}`,
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 8px 24px rgba(100, 75, 15, 0.10)",
  };
}

function rowStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    background: "#fffaf0",
    border: "1.5px solid #d1d5db",
    borderRadius: 14,
    padding: 14,
    flexWrap: "wrap",
  };
}

function miniBoxStyle(): React.CSSProperties {
  return {
    background: "#fffaf0",
    border: `1px solid rgba(181, 139, 22, 0.45)`,
    borderRadius: 16,
    padding: 14,
    fontWeight: 700,
    color: DARK,
  };
}
