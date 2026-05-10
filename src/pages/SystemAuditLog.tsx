// src/pages/SystemAuditLog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  appendAuditEntry,
  clearAuditEntries,
  exportAuditEntriesFile,
  getAuditEntries,
  getCloudAuditEntries,
  mergeAuditEntries,
  isCloudAuditEnabled,
  setCloudAuditEnabled,
  AUDIT_CLOUD_LAST_OK_KEY,
  AUDIT_CLOUD_LAST_ERROR_KEY,
  type AuditEntry,
} from "../features/audit/auditTrail";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function levelLabel(level: AuditEntry["level"]) {
  if (level === "danger") return "إجراء حساس";
  if (level === "warning") return "إجراء تشغيلي";
  return "إجراء عام";
}

function actionLabel(action: string) {
  if (action === "page_view") return "فتح صفحة";
  if (action === "click") return "ضغط زر";
  return action || "عملية";
}

function levelStyle(level: AuditEntry["level"]): React.CSSProperties {
  if (level === "danger") return { background: "#fee2e2", color: "#991b1b", borderColor: "#ef4444" };
  if (level === "warning") return { background: "#fef3c7", color: "#92400e", borderColor: "#f59e0b" };
  return { background: "#dcfce7", color: "#166534", borderColor: "#22c55e" };
}

function storageValue(keys: string[]) {
  if (typeof window === "undefined") return "";
  for (const key of keys) {
    try {
      const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (value) return String(value).trim();
    } catch {
      // ignore
    }
  }
  return "";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  direction: "rtl",
  background: "linear-gradient(180deg, #f8f1dc 0%, #efe4c4 100%)",
  padding: 28,
  color: "#111827",
  fontFamily: "Tajawal, system-ui, Arial, sans-serif",
};

const card: React.CSSProperties = {
  background: "rgba(255,252,242,0.98)",
  border: "3px solid #c9a227",
  borderRadius: 28,
  boxShadow: "0 18px 42px rgba(70, 53, 12, 0.14)",
  padding: 24,
  marginBottom: 22,
  color: "#111827",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "2px solid #d6b24c",
  borderRadius: 14,
  padding: "13px 16px",
  background: "#fffdf5",
  color: "#000",
  fontWeight: 1000,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  border: "2px solid #b8941f",
  borderRadius: 14,
  padding: "11px 16px",
  background: "#fff7df",
  color: "#111827",
  fontWeight: 1000,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  background: "#ead789",
  color: "#111827",
  padding: 12,
  borderBottom: "2px solid #c9a227",
  fontWeight: 1000,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #ead789",
  color: "#111827",
  fontWeight: 800,
  verticalAlign: "top",
};

export default function SystemAuditLog() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditEntry[]>(() => getAuditEntries());
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [cloudStatus, setCloudStatus] = useState("جاهز للقراءة");
  const [cloudEnabled, setCloudEnabledState] = useState(() => isCloudAuditEnabled());

  const refreshLocal = () => setEntries(getAuditEntries());

  const loadCloud = async () => {
    const role = storageValue(["effectiveRole", "viewAsRole", "role"]);
    const governorate = storageValue(["effectiveGovernorate", "governorateSuperScope", "governorate"]);
    setCloudStatus("جاري قراءة السجل السحابي...");
    try {
      const cloud = await getCloudAuditEntries({ role, governorate, max: 500 });
      const local = getAuditEntries();
      setEntries(mergeAuditEntries(cloud, local));
      setCloudStatus(`تم تحميل ${cloud.length} عملية من السحابة`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "خطأ غير معروف");
      setEntries(getAuditEntries());
      setCloudStatus(`تعذر قراءة السجل السحابي: ${message}`);
    }
  };

  const refresh = () => {
    refreshLocal();
    void loadCloud();
  };

  const lastCloudOk = storageValue([AUDIT_CLOUD_LAST_OK_KEY]);
  const lastCloudError = storageValue([AUDIT_CLOUD_LAST_ERROR_KEY]);

  useEffect(() => {
    appendAuditEntry({
      level: "info",
      action: "page_view",
      label: "فتح صفحة سجل العمليات",
      path: window.location.pathname || "/system/audit-log",
      tenantId: storageValue(["effectiveTenantId", "selectedTenantId", "tenantId", "viewAsTenantId"]),
      userEmail: storageValue(["currentUserEmail", "viewAsEmail", "userEmail"]),
      role: storageValue(["effectiveRole", "viewAsRole", "role"]),
      governorate: storageValue(["effectiveGovernorate", "governorateSuperScope", "governorate"]),
      readOnly: ["1", "true", "yes"].includes(storageValue(["viewAsReadOnly", "governorateSuperReadOnly", "readOnly"]).toLowerCase()),
      source: "audit-log-page",
    });
    refresh();

    const onChange = () => refresh();
    window.addEventListener("exam-manager:audit-log-changed", onChange as EventListener);
    return () => window.removeEventListener("exam-manager:audit-log-changed", onChange as EventListener);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesLevel = level === "all" || entry.level === level;
      const haystack = [
        entry.label,
        entry.path,
        entry.tenantId,
        entry.userEmail,
        entry.role,
        entry.governorate,
        entry.action,
        entry.source,
      ]
        .join(" ")
        .toLowerCase();
      return matchesLevel && (!q || haystack.includes(q));
    });
  }, [entries, level, search]);

  const dangerCount = entries.filter((entry) => entry.level === "danger").length;
  const warningCount = entries.filter((entry) => entry.level === "warning").length;

  const addTestEntry = () => {
    appendAuditEntry({
      level: "info",
      action: "test",
      label: "فحص تسجيل سجل العمليات",
      path: window.location.pathname || "/system/audit-log",
      userEmail: storageValue(["currentUserEmail", "viewAsEmail", "userEmail"]),
      role: storageValue(["effectiveRole", "viewAsRole", "role"]),
      governorate: storageValue(["effectiveGovernorate", "governorateSuperScope", "governorate"]),
      source: "manual-test",
    });
    refresh();
  };

  return (
    <main style={page}>
      <section style={{ ...card, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18 }}>
        <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 1000, color: "#111827" }}>سلطنة عمان</div>
          <div style={{ fontSize: 20, fontWeight: 1000, color: "#111827" }}>وزارة التعليم</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>نظام إدارة الامتحانات المطور</div>
        </div>
        <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={{ width: 92, height: 92, objectFit: "contain", border: "2px solid #d6b24c", borderRadius: 18, background: "#fff" }} />
        <div style={{ textAlign: "left" }}>
          <button style={buttonStyle} onClick={() => navigate(-1)}>العودة</button>
        </div>
        <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
          <h1 style={{ margin: "12px 0 8px", fontSize: 48, fontWeight: 1000, color: "#111827" }}>سجل العمليات</h1>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#374151" }}>
            متابعة الإجراءات الحساسة داخل النظام مثل الحفظ والحذف والاستيراد والتوزيع والاستعادة.
          </p>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 22 }}>
        <div style={card}><div style={{ fontSize: 34, fontWeight: 1000, color: "#111827" }}>{entries.length}</div><div style={{ fontWeight: 1000, color: "#111827" }}>إجمالي العمليات</div></div>
        <div style={card}><div style={{ fontSize: 34, fontWeight: 1000, color: "#111827" }}>{dangerCount}</div><div style={{ fontWeight: 1000, color: "#111827" }}>عمليات حساسة</div></div>
        <div style={card}><div style={{ fontSize: 34, fontWeight: 1000, color: "#111827" }}>{warningCount}</div><div style={{ fontWeight: 1000, color: "#111827" }}>عمليات تشغيلية</div></div>
        <div style={card}><div style={{ fontSize: 34, fontWeight: 1000, color: "#111827" }}>{filtered.length}</div><div style={{ fontWeight: 1000, color: "#111827" }}>نتائج العرض الحالية</div></div>
      </section>

      <section style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px auto auto auto auto auto", gap: 12, alignItems: "end", marginBottom: 18 }}>
          <label style={{ fontWeight: 1000, color: "#111827" }}>
            بحث
            <input style={{ ...inputStyle, marginTop: 8 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالبريد أو الدور أو المسار أو نوع العملية..." />
          </label>
          <label style={{ fontWeight: 1000, color: "#111827" }}>
            نوع العملية
            <select style={{ ...inputStyle, marginTop: 8 }} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">الكل</option>
              <option value="danger">حساسة</option>
              <option value="warning">تشغيلية</option>
              <option value="info">عامة</option>
            </select>
          </label>
          <button style={buttonStyle} onClick={refresh}>تحديث السجل</button>
          <button
            style={{ ...buttonStyle, background: cloudEnabled ? "#dcfce7" : "#fee2e2", color: cloudEnabled ? "#166534" : "#991b1b" }}
            onClick={() => {
              const next = !cloudEnabled;
              setCloudAuditEnabled(next);
              setCloudEnabledState(next);
              setCloudStatus(next ? "تم تفعيل التسجيل السحابي" : "تم إيقاف التسجيل السحابي مؤقتًا");
            }}
          >
            {cloudEnabled ? "السجل السحابي مفعل" : "السجل السحابي متوقف"}
          </button>
          <button style={buttonStyle} onClick={addTestEntry}>تسجيل فحص</button>
          <button style={buttonStyle} onClick={() => exportAuditEntriesFile(filtered)}>تصدير JSON</button>
          <button
            style={{ ...buttonStyle, borderColor: "#dc2626", color: "#991b1b" }}
            onClick={() => {
              if (window.confirm("هل تريد تنظيف السجل المحلي من هذا الجهاز؟")) {
                clearAuditEntries();
                refresh();
              }
            }}
          >
            تنظيف السجل المحلي
          </button>
        </div>

        <div style={{ border: "2px solid #d6b24c", background: "#fffdf5", color: "#111827", borderRadius: 18, padding: 14, fontWeight: 1000, marginBottom: 16 }}>
          حالة السجل السحابي: {cloudStatus}
          {lastCloudOk ? <span style={{ marginInlineStart: 14, color: "#166534" }}>آخر حفظ سحابي ناجح: {fmt(lastCloudOk)}</span> : null}
          {lastCloudError ? <span style={{ marginInlineStart: 14, color: "#991b1b" }}>آخر خطأ: {lastCloudError}</span> : null}
        </div>

        {entries.length === 0 ? (
          <div style={{ border: "2px solid #f59e0b", background: "#fffbeb", color: "#92400e", borderRadius: 18, padding: 18, fontWeight: 1000, textAlign: "center" }}>
            لا توجد عمليات مسجلة بعد. بعد هذا التعديل سيتم تسجيل فتح الصفحات والضغط على الأزرار المهمة تلقائيًا. اضغط "تسجيل فحص" للتأكد من عمل السجل.
          </div>
        ) : null}

        <div style={{ overflowX: "auto", border: "2px solid #d6b24c", borderRadius: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, background: "#fffdf5" }}>
            <thead>
              <tr>
                <th style={thStyle}>الوقت</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>الإجراء</th>
                <th style={thStyle}>المستخدم</th>
                <th style={thStyle}>الدور</th>
                <th style={thStyle}>النطاق</th>
                <th style={thStyle}>المسار</th>
                <th style={thStyle}>وضع المشاهدة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 28 }}>
                    لا توجد عمليات مطابقة للعرض الحالي.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tdStyle}>{fmt(entry.at)}</td>
                    <td style={tdStyle}>
                      <span style={{ ...levelStyle(entry.level), border: "1px solid", borderRadius: 999, padding: "6px 10px", fontWeight: 1000 }}>
                        {levelLabel(entry.level)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 1000 }}>{entry.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{actionLabel(entry.action)} · {entry.source || "local"}</div>
                    </td>
                    <td style={tdStyle}>{entry.userEmail || "-"}</td>
                    <td style={tdStyle}>{entry.role || "-"}</td>
                    <td style={tdStyle}>{entry.governorate || entry.tenantId || "-"}</td>
                    <td style={{ ...tdStyle, direction: "ltr", textAlign: "left" }}>{entry.path || "-"}</td>
                    <td style={tdStyle}>{entry.readOnly ? "مشاهدة فقط" : "تشغيل عادي"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
