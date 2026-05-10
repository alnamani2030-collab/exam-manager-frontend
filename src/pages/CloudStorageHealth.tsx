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
};

const GOLD = "#b58b16";
const DARK = "#1f2937";
const BEIGE = "#f7efe0";
const CARD = "rgba(255, 252, 242, 0.92)";
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
  const auth = useAuth() as any;
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


  function clearInternalCloudCache() {
    if (typeof window === "undefined") return;
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
    clearInternalCloudCache();
    setActionMessage(tr("تم تنظيف الكاش وسيتم تحديث الصفحة الآن لجلب أحدث بيانات من السحابة.", "Cache cleared. The page will refresh to load the latest cloud data."));
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function copyDiagnosticReport() {
    const report = {
      tenantId: tid,
      readOnly,
      lastCheckedAt,
      localStorage: readLocalStorageSummary(),
      tests: tests.map((test) => ({ id: test.id, status: test.status, details: test.details })),
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
    if (!tid) return;
    setRunning(true);
    setTests([
      { id: "local", title: tr("فحص التخزين المحلي", "Local storage check"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "config", title: tr("قراءة إعدادات المركز", "Read tenant config"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "cloudLocalStorageRead", title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
      { id: "cloudLocalStorageWrite", title: tr("اختبار الكتابة السحابية", "Cloud write test"), status: "wait", details: tr("جاري الفحص...", "Checking...") },
    ]);

    const next: HealthTest[] = [];

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
      });
    } catch (error) {
      next.push({ id: "local", title: tr("فحص التخزين المحلي", "Local storage check"), status: "fail", details: errorMessage(error) });
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
      });
    } catch (error) {
      next.push({ id: "config", title: tr("قراءة إعدادات المركز", "Read tenant config"), status: "fail", details: errorMessage(error) });
    }

    try {
      await getDocs(query(collection(db, "tenants", tid, "cloudLocalStorage"), limit(1)));
      next.push({
        id: "cloudLocalStorageRead",
        title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"),
        status: "pass",
        details: tr("تمت قراءة مسار cloudLocalStorage بنجاح.", "cloudLocalStorage path was read successfully."),
      });
    } catch (error) {
      next.push({ id: "cloudLocalStorageRead", title: tr("قراءة التخزين السحابي العام", "Read cloud local storage"), status: "fail", details: errorMessage(error) });
    }

    if (readOnly) {
      next.push({
        id: "cloudLocalStorageWrite",
        title: tr("اختبار الكتابة السحابية", "Cloud write test"),
        status: "skip",
        details: tr("تم تجاوز اختبار الكتابة لأنك داخل المركز بوضع مشاهدة فقط.", "Write test skipped because this tenant is opened in read-only mode."),
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
        });
      } catch (error) {
        next.push({ id: "cloudLocalStorageWrite", title: tr("اختبار الكتابة السحابية", "Cloud write test"), status: "fail", details: errorMessage(error) });
      }
    }

    setTests(next);
    setLastCheckedAt(new Date().toLocaleString(lang === "ar" ? "ar" : "en"));
    setRunning(false);
  }

  useEffect(() => {
    void runHealthCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, readOnly, lang]);

  const failedCount = tests.filter((test) => test.status === "fail").length;
  const passedCount = tests.filter((test) => test.status === "pass").length;

  return (
    <main
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        padding: 28,
        background: `linear-gradient(180deg, ${BEIGE} 0%, #fffaf0 50%, #f2e3bd 100%)`,
        color: DARK,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          border: `4px solid ${GOLD}`,
          borderRadius: 28,
          background: CARD,
          padding: 28,
          boxShadow: "0 18px 45px rgba(100, 75, 15, 0.18)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              border: `2px solid ${GOLD}`,
              background: "#fffaf0",
              color: DARK,
              padding: "12px 20px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {tr("العودة", "Back")}
          </button>

          <div style={{ textAlign: "center", flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 42, fontWeight: 1000, color: DARK }}>
              {tr("فحص التخزين السحابي", "Cloud Storage Health Check")}
            </h1>
            <p style={{ margin: "12px 0 0", fontWeight: 800, color: "#6b4e09" }}>
              {tr("فحص القراءة والكتابة والمشاهدة فقط داخل نطاق المركز الحالي", "Check read, write, and read-only status for the current tenant")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "center" }}>
               <div style={{ fontWeight: 1000, color: "#6b4e09" }}>{tr("سلطنة عمان", "Ministry of Education")}</div>
              <div style={{ fontWeight: 1000, color: "#6b4e09" }}>{tr("وزارة التعليم", "Ministry of Education")}</div>
              <div style={{ fontWeight: 800 }}>{tid || tr("لا يوجد نطاق", "No tenant")}</div>
            </div>
            <img
              src={LOGO_URL}
              alt="logo"
              style={{ width: 82, height: 82, objectFit: "contain", border: `2px solid ${GOLD}`, borderRadius: 18, background: "#fffaf0", padding: 8 }}
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
          <div style={labelStyle()}>{tr("وضع الدخول", "Access mode")}</div>
          <div style={{ fontWeight: 1000, color: readOnly ? "#854d0e" : "#166534", fontSize: 22 }}>
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
            <p style={{ margin: "6px 0 0", color: "#4b5563", fontWeight: 700 }}>
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
            <button type="button" onClick={clearInternalCloudCache} style={actionButtonStyle("#2563eb", false)}>
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

        {actionMessage ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(37, 99, 235, 0.35)",
              background: "#eff6ff",
              color: "#1e3a8a",
              fontWeight: 900,
            }}
          >
            {actionMessage}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          {tests.map((test) => (
            <article key={test.id} style={{ ...rowStyle(), borderColor: statusColor(test.status) }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, color: DARK }}>{test.title}</h3>
                <p style={{ margin: "8px 0 0", color: "#4b5563", fontWeight: 700, lineHeight: 1.8 }}>{test.details}</p>
              </div>
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
            </article>
          ))}
        </div>
      </section>

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
    padding: "13px 18px",
    borderRadius: 14,
    fontWeight: 1000,
    cursor: disabled ? "default" : "pointer",
    boxShadow: "0 8px 18px rgba(31, 41, 55, 0.16)",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    background: CARD,
    border: `2px solid rgba(181, 139, 22, 0.45)`,
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 12px 28px rgba(100, 75, 15, 0.12)",
  };
}

function labelStyle(): React.CSSProperties {
  return { color: "#6b4e09", fontWeight: 900, marginBottom: 8 };
}

function numberStyle(color: string): React.CSSProperties {
  return { color, fontSize: 38, fontWeight: 1000, lineHeight: 1 };
}

function panelStyle(): React.CSSProperties {
  return {
    background: CARD,
    border: `3px solid rgba(181, 139, 22, 0.52)`,
    borderRadius: 26,
    padding: 24,
    boxShadow: "0 16px 38px rgba(100, 75, 15, 0.14)",
  };
}

function rowStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    background: "#fffaf0",
    border: "2px solid #d1d5db",
    borderRadius: 18,
    padding: 18,
    flexWrap: "wrap",
  };
}

function miniBoxStyle(): React.CSSProperties {
  return {
    background: "#fffaf0",
    border: `1px solid rgba(181, 139, 22, 0.45)`,
    borderRadius: 16,
    padding: 14,
    fontWeight: 900,
    color: DARK,
  };
}
