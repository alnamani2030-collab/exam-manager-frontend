// src/pages/SystemMonitoringDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD = "#b9931f";
const INK = "#111827";
const BORDER = "rgba(185,147,31,0.55)";
const BG = "#f5efe1";
const CARD = "rgba(255,253,247,0.92)";

type Snapshot = {
  localKeys: number;
  cloudCacheKeys: number;
  cloudStatusKeys: number;
  auditRows: number;
  errorRows: number;
  criticalErrors: number;
  warnings: number;
  online: boolean;
  lastCloudSuccess: string;
  lastCloudWarning: string;
  lastCloudError: string;
  currentUser: string;
  role: string;
  governorate: string;
  tenantId: string;
  readOnly: boolean;
  createdAt: string;
};

function readStorage(key: string) {
  try {
    return String(window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

function parseArray(value: string): any[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAllKeys() {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }
  } catch {}
  return keys;
}

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function makeSnapshot(auth: any): Snapshot {
  const keys = getAllKeys();
  const profile = getProfile(auth);
  const auditRows = [
    ...parseArray(readStorage("exam-manager:system-audit-log:v1")),
    ...parseArray(readStorage("systemAuditLog")),
    ...parseArray(readStorage("auditTrail")),
  ];
  const errorRows = [
    ...parseArray(readStorage("exam-manager:system-error-log:v1")),
    ...parseArray(readStorage("systemErrorLog")),
    ...parseArray(readStorage("errorDiagnostics")),
  ];

  const criticalErrors = errorRows.filter((row: any) => {
    const type = String(row?.type || row?.level || row?.severity || "").toLowerCase();
    const msg = String(row?.message || row?.error || "").toLowerCase();
    return type.includes("error") || type.includes("critical") || msg.includes("maximum update depth") || msg.includes("permission");
  }).length;

  const warnings = errorRows.filter((row: any) => {
    const type = String(row?.type || row?.level || row?.severity || "").toLowerCase();
    return type.includes("warn") || type.includes("warning");
  }).length;

  const currentUser = String(auth?.user?.email || profile?.email || readStorage("userEmail") || "غير محدد");
  const role = String(profile?.role || auth?.effectiveRole || readStorage("role") || "غير محدد");
  const governorate = String(profile?.governorate || profile?.scope || readStorage("governorate") || readStorage("scope") || "غير محدد");
  const tenantId = String(profile?.tenantId || auth?.tenantId || readStorage("tenantId") || readStorage("selectedTenantId") || "غير محدد");
  const readOnly = [readStorage("governorateSuperReadOnly"), readStorage("viewAsReadOnly"), readStorage("readOnly")]
    .some((v) => ["1", "true", "yes"].includes(String(v || "").toLowerCase()));

  return {
    localKeys: keys.length,
    cloudCacheKeys: keys.filter((k) => k.includes("cloud-cache")).length,
    cloudStatusKeys: keys.filter((k) => k.includes("cloud-storage") || k.includes("cloudLocalStorage")).length,
    auditRows: auditRows.length,
    errorRows: errorRows.length,
    criticalErrors,
    warnings,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastCloudSuccess: readStorage("exam-manager:cloud-storage:last-success-at") || "غير مسجل",
    lastCloudWarning: readStorage("exam-manager:cloud-storage:last-warning") || "لا يوجد",
    lastCloudError: readStorage("exam-manager:cloud-storage:last-error") || "لا يوجد",
    currentUser,
    role,
    governorate,
    tenantId,
    readOnly,
    createdAt: new Date().toLocaleString("ar"),
  };
}

function statusLabel(snapshot: Snapshot) {
  if (!snapshot.online) return { label: "الاتصال غير مستقر", tone: "danger" };
  if (snapshot.criticalErrors > 0) return { label: "يحتاج مراجعة", tone: "warning" };
  if (snapshot.errorRows > 0) return { label: "مستقر مع تنبيهات", tone: "warning" };
  return { label: "مستقر", tone: "ok" };
}

function downloadJson(name: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SystemMonitoringDashboard() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const [snapshot, setSnapshot] = useState<Snapshot>(() => makeSnapshot(auth));

  useEffect(() => {
    const refresh = () => setSnapshot(makeSnapshot(auth));
    refresh();
    const id = window.setInterval(refresh, 15000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [auth]);

  const status = useMemo(() => statusLabel(snapshot), [snapshot]);

  const cardStyle: React.CSSProperties = {
    background: CARD,
    border: `2px solid ${BORDER}`,
    borderRadius: 22,
    padding: 18,
    color: INK,
    boxShadow: "0 12px 28px rgba(17,24,39,0.08)",
  };

  const buttonStyle: React.CSSProperties = {
    border: `2px solid ${GOLD}`,
    background: "#fffaf0",
    color: INK,
    borderRadius: 14,
    padding: "10px 16px",
    fontWeight: 900,
    cursor: "pointer",
  };

  const statusColor = status.tone === "ok" ? "#116530" : status.tone === "danger" ? "#991b1b" : "#92400e";

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: BG, color: INK, padding: 28, fontFamily: "inherit" }}>
      <section style={{ ...cardStyle, minHeight: 210, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 20 }}>
        <div style={{ textAlign: "right", fontWeight: 900 }}>
           <div style={{ fontSize: 22 }}>سلطنة  عمان</div>
          <div style={{ fontSize: 22 }}>وزارة التعليم</div>
          <div style={{ marginTop: 6 }}>نظام إدارة الامتحانات المطور</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={{ width: 88, height: 88, objectFit: "contain", border: `2px solid ${GOLD}`, borderRadius: 18, background: "#fff" }} />
          <h1 style={{ margin: "18px 0 8px", fontSize: 44, color: INK }}>مركز مراقبة النظام</h1>
          <p style={{ margin: 0, fontWeight: 800 }}>متابعة حالة السحابة، السجلات، الأخطاء، والمستخدم الحالي من شاشة واحدة.</p>
        </div>
        <div style={{ textAlign: "left" }}>
          <button style={buttonStyle} onClick={() => navigate("/system")}>العودة</button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginTop: 22 }}>
        <div style={cardStyle}><div style={{ fontSize: 34, fontWeight: 900, color: statusColor }}>{status.label}</div><div style={{ fontWeight: 900 }}>حالة النظام</div></div>
        <div style={cardStyle}><div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.errorRows}</div><div style={{ fontWeight: 900 }}>أخطاء وتنبيهات</div></div>
        <div style={cardStyle}><div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.auditRows}</div><div style={{ fontWeight: 900 }}>عمليات مسجلة</div></div>
        <div style={cardStyle}><div style={{ fontSize: 34, fontWeight: 900 }}>{snapshot.online ? "متصل" : "غير متصل"}</div><div style={{ fontWeight: 900 }}>حالة الاتصال</div></div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginTop: 22 }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, color: INK }}>ملخص الحالة التشغيلية</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, fontWeight: 900, lineHeight: 2 }}>
            <div>المستخدم: <span style={{ color: GOLD }}>{snapshot.currentUser}</span></div>
            <div>الدور: <span style={{ color: GOLD }}>{snapshot.role}</span></div>
            <div>المحافظة / النطاق: <span style={{ color: GOLD }}>{snapshot.governorate}</span></div>
            <div>المدرسة / المركز: <span style={{ color: GOLD }}>{snapshot.tenantId}</span></div>
            <div>وضع المشاهدة: <span style={{ color: snapshot.readOnly ? "#991b1b" : "#116530" }}>{snapshot.readOnly ? "مفعل" : "غير مفعل"}</span></div>
            <div>آخر تحديث: <span style={{ color: GOLD }}>{snapshot.createdAt}</span></div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, color: INK }}>حالة التخزين السحابي</h2>
          <div style={{ fontWeight: 900, lineHeight: 2 }}>
            <div>مفاتيح التخزين المحلي: {snapshot.localKeys}</div>
            <div>مفاتيح كاش السحابة: {snapshot.cloudCacheKeys}</div>
            <div>مفاتيح حالة السحابة: {snapshot.cloudStatusKeys}</div>
            <div>آخر نجاح مزامنة: {snapshot.lastCloudSuccess}</div>
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 22 }}>
        <h2 style={{ marginTop: 0, color: INK }}>روابط الفحص السريع</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={buttonStyle} onClick={() => setSnapshot(makeSnapshot(auth))}>تحديث المراقبة</button>
          <button style={buttonStyle} onClick={() => navigate("/system/error-log")}>فتح سجل الأخطاء</button>
          <button style={buttonStyle} onClick={() => navigate("/system/audit-log")}>فتح سجل العمليات</button>
          <button style={buttonStyle} onClick={() => navigate("/system/permissions-audit")}>فحص الصلاحيات والربط</button>
          <button style={buttonStyle} onClick={() => navigate("/system/commercial-readiness")}>لوحة الجاهزية التجارية</button>
          <button style={buttonStyle} onClick={() => downloadJson(`system-monitoring-${Date.now()}.json`, snapshot)}>تصدير تقرير JSON</button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 22, borderColor: snapshot.lastCloudError !== "لا يوجد" ? "#991b1b" : BORDER }}>
        <h2 style={{ marginTop: 0, color: INK }}>آخر رسائل السحابة</h2>
        <div style={{ display: "grid", gap: 10, fontWeight: 900, lineHeight: 1.8 }}>
          <div>آخر تحذير: <span style={{ color: snapshot.lastCloudWarning === "لا يوجد" ? "#116530" : "#92400e" }}>{snapshot.lastCloudWarning}</span></div>
          <div>آخر خطأ: <span style={{ color: snapshot.lastCloudError === "لا يوجد" ? "#116530" : "#991b1b" }}>{snapshot.lastCloudError}</span></div>
        </div>
      </section>
    </main>
  );
}
