// src/pages/SystemMaintenanceCenter.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD = "#b9931f";
const INK = "#111827";
const BG = "#f5efe1";
const CARD = "rgba(255,253,247,0.94)";
const BORDER = "rgba(185,147,31,0.58)";
const GREEN = "#0f7a3a";
const RED = "#9f1239";

type StorageItem = {
  key: string;
  bytes: number;
  category: string;
};

function safeGetLocalKeys(): StorageItem[] {
  const rows: StorageItem[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) || "";
      const value = window.localStorage.getItem(key) || "";
      let category = "بيانات عامة";
      if (key.includes("cloud-cache")) category = "كاش السحابة";
      else if (key.includes("cloud-storage")) category = "حالة التخزين السحابي";
      else if (key.includes("system-audit") || key.toLowerCase().includes("audit")) category = "سجل العمليات";
      else if (key.includes("system-error") || key.toLowerCase().includes("error")) category = "سجل الأخطاء";
      else if (key.includes("readonly") || key.includes("viewAs")) category = "وضع المشاهدة";
      rows.push({ key, bytes: new Blob([value]).size, category });
    }
  } catch {}
  return rows.sort((a, b) => b.bytes - a.bytes);
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function removeByPredicate(predicate: (key: string) => boolean) {
  let count = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => {
      window.localStorage.removeItem(key);
      count += 1;
    });
  } catch {}
  return count;
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function readSessionFlag(...keys: string[]) {
  for (const key of keys) {
    try {
      const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (value) return value;
    } catch {}
  }
  return "";
}

export default function SystemMaintenanceCenter() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const profile = getProfile(auth);
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState("");

  const rows = useMemo(() => safeGetLocalKeys(), [tick]);
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  const cloudCacheCount = rows.filter((row) => row.category === "كاش السحابة").length;
  const logsCount = rows.filter((row) => row.category === "سجل العمليات" || row.category === "سجل الأخطاء").length;
  const readonlyFlag = readSessionFlag("exam-manager:view-as-readonly", "viewAsReadOnly", "readOnly");

  const email = String(auth?.user?.email || profile?.email || "-");
  const role = String(profile?.role || profile?.primaryRole || (auth?.isSuperAdmin ? "super_admin" : "-") || "-");
  const governorate = String(profile?.governorate || profile?.tenantGovernorate || "-");
  const tenantId = String(profile?.tenantId || "-");

  const makeMaintenanceReport = () => ({
    createdAt: new Date().toISOString(),
    user: { email, role, governorate, tenantId },
    browser: {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      language: navigator.language,
    },
    storage: {
      totalKeys: rows.length,
      totalBytes,
      cloudCacheCount,
      logsCount,
      readonlyFlag: Boolean(readonlyFlag),
      topKeys: rows.slice(0, 50),
    },
  });

  const clearCloudCache = () => {
    const count = removeByPredicate((key) => key.includes("cloud-cache") || key.includes("cloud-storage:last-warning") || key.includes("cloud-storage:last-error"));
    setTick((v) => v + 1);
    setMessage(`تم تنظيف ${count} مفتاح من كاش السحابة والتنبيهات المؤقتة.`);
  };

  const clearLocalLogs = () => {
    const count = removeByPredicate((key) => key.includes("system-audit") || key.includes("system-error") || key.toLowerCase().includes("audittrail") || key.toLowerCase().includes("errordiagnostics"));
    setTick((v) => v + 1);
    setMessage(`تم تنظيف ${count} مفتاح من سجلات المتصفح المحلية فقط.`);
  };

  const exportReport = () => {
    downloadJson(`system-maintenance-report-${new Date().toISOString().slice(0, 10)}.json`, makeMaintenanceReport());
    setMessage("تم تصدير تقرير الصيانة بنجاح.");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(makeMaintenanceReport(), null, 2));
      setMessage("تم نسخ تقرير الصيانة إلى الحافظة.");
    } catch {
      setMessage("تعذر النسخ التلقائي. استخدم زر التصدير بدلًا من ذلك.");
    }
  };

  const hardRefresh = () => {
    window.location.reload();
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: BG, padding: 28, color: INK, fontFamily: "system-ui, Tahoma, Arial" }}>
      <section style={{ border: `3px solid ${GOLD}`, borderRadius: 26, background: CARD, padding: 28, boxShadow: "0 18px 45px rgba(0,0,0,0.10)" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ float: "left", border: `2px solid ${GOLD}`, background: "#fffaf0", color: INK, borderRadius: 10, padding: "10px 18px", fontWeight: 900, cursor: "pointer" }}
        >
          العودة
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={{ width: 86, height: 86, objectFit: "contain", border: `2px solid ${GOLD}`, borderRadius: 16, padding: 8, background: "#fff" }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>وزارة التعليم</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>نظام إدارة الامتحانات المطور</div>
            </div>
          </div>
          <div style={{ textAlign: "left", fontWeight: 800, lineHeight: 1.9 }}>
            <div>{email}</div>
            <div>{role}</div>
          </div>
        </div>
        <h1 style={{ textAlign: "center", fontSize: 48, margin: "28px 0 8px", fontWeight: 950, color: INK }}>مركز صيانة النظام</h1>
        <p style={{ textAlign: "center", fontSize: 17, fontWeight: 800, margin: 0 }}>
          أدوات آمنة لتنظيف الكاش المحلي، تصدير تقرير الصيانة، ومراجعة حالة التخزين بدون حذف بيانات السحابة الأصلية.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 16, marginTop: 22 }}>
        {[
          ["مفاتيح التخزين المحلي", rows.length],
          ["حجم التخزين التقريبي", fmtBytes(totalBytes)],
          ["مفاتيح كاش السحابة", cloudCacheCount],
          ["مفاتيح السجلات المحلية", logsCount],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ border: `2px solid ${GOLD}`, borderRadius: 18, background: CARD, padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 950 }}>{String(value)}</div>
            <div style={{ fontWeight: 900, color: "#5f4a08" }}>{String(label)}</div>
          </div>
        ))}
      </section>

      {message ? (
        <div style={{ marginTop: 18, border: `2px solid ${GREEN}`, borderRadius: 16, background: "#ecfdf5", color: GREEN, padding: 14, fontWeight: 900 }}>
          {message}
        </div>
      ) : null}

      <section style={{ marginTop: 22, border: `2px solid ${GOLD}`, borderRadius: 22, background: CARD, padding: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 28 }}>أدوات الصيانة الآمنة</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={clearCloudCache} style={buttonStyle(GREEN)}>تنظيف كاش السحابة المحلي</button>
          <button onClick={clearLocalLogs} style={buttonStyle(RED)}>تنظيف السجلات المحلية فقط</button>
          <button onClick={exportReport} style={buttonStyle(GOLD)}>تصدير تقرير الصيانة JSON</button>
          <button onClick={copyReport} style={buttonStyle("#1d4ed8")}>نسخ تقرير الصيانة</button>
          <button onClick={() => setTick((v) => v + 1)} style={buttonStyle("#4b5563")}>تحديث القراءة</button>
          <button onClick={hardRefresh} style={buttonStyle("#7c3aed")}>إعادة تحميل الصفحة</button>
        </div>
        <p style={{ marginBottom: 0, fontWeight: 800, lineHeight: 2 }}>
          ملاحظة: هذه الأدوات لا تحذف بيانات Firestore الأصلية. التنظيف هنا يخص كاش المتصفح والسجلات المحلية فقط.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 16, marginTop: 22 }}>
        <div style={panelStyle()}>
          <h3 style={h3Style}>بيانات الجلسة الحالية</h3>
          <Info label="المستخدم" value={email} />
          <Info label="الدور" value={role} />
          <Info label="المحافظة" value={governorate} />
          <Info label="Tenant" value={tenantId} />
          <Info label="وضع المشاهدة فقط" value={readonlyFlag ? "مفعل" : "غير مفعل"} />
        </div>
        <div style={panelStyle()}>
          <h3 style={h3Style}>روابط متابعة سريعة</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => navigate("/system/monitoring")} style={smallButton}>مركز مراقبة النظام</button>
            <button onClick={() => navigate("/system/error-log")} style={smallButton}>سجل الأخطاء</button>
            <button onClick={() => navigate("/system/audit-log")} style={smallButton}>سجل العمليات</button>
            <button onClick={() => navigate("/system/permissions-audit")} style={smallButton}>فحص الصلاحيات والربط</button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 22, border: `2px solid ${GOLD}`, borderRadius: 22, background: CARD, padding: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 28 }}>أكبر مفاتيح التخزين المحلي</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontWeight: 800 }}>
            <thead>
              <tr style={{ background: "#eadf9c" }}>
                <th style={th}>المفتاح</th>
                <th style={th}>التصنيف</th>
                <th style={th}>الحجم</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((row) => (
                <tr key={row.key}>
                  <td style={td}>{row.key}</td>
                  <td style={td}>{row.category}</td>
                  <td style={td}>{fmtBytes(row.bytes)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={3} style={{ ...td, textAlign: "center" }}>لا توجد مفاتيح محلية للعرض.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", borderBottom: "1px solid rgba(185,147,31,0.22)", padding: "10px 0", gap: 10 }}>
      <b style={{ color: "#5f4a08" }}>{label}</b>
      <span style={{ fontWeight: 900 }}>{value || "-"}</span>
    </div>
  );
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    border: `2px solid ${color}`,
    color,
    background: "#fffaf0",
    borderRadius: 12,
    padding: "12px 18px",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function panelStyle(): React.CSSProperties {
  return { border: `2px solid ${BORDER}`, borderRadius: 20, background: CARD, padding: 20 };
}

const h3Style: React.CSSProperties = { fontSize: 24, marginTop: 0, color: INK };
const th: React.CSSProperties = { border: `1px solid ${BORDER}`, padding: 12, textAlign: "right", color: INK };
const td: React.CSSProperties = { border: `1px solid rgba(185,147,31,0.24)`, padding: 12, color: INK, wordBreak: "break-word" };
const smallButton: React.CSSProperties = { border: `2px solid ${GOLD}`, background: "#fffaf0", color: INK, borderRadius: 12, padding: "12px 14px", fontWeight: 950, cursor: "pointer", textAlign: "right" };
