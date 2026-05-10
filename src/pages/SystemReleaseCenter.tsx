// src/pages/SystemReleaseCenter.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const GOLD = "#b7952b";
const GOLD_DARK = "#7a5a08";
const INK = "#111827";
const MUTED = "#334155";
const PAPER = "#f7f1df";
const CARD = "#fffaf0";
const LINE = "rgba(183,149,43,0.72)";

const CURRENT_PHASE = 49;
const RELEASE_NAME = "النسخة السحابية التجارية التجريبية";
const RELEASE_CODE = "cloud-commercial-r49";

type ReleaseItem = {
  phase: number;
  title: string;
  status: "done" | "needs-test" | "next";
  note: string;
};

const releaseItems: ReleaseItem[] = [
  { phase: 30, title: "تسريع السحابة وإظهار زر الفحص", status: "done", note: "إظهار بيانات الكاش أولًا ثم تحديث السحابة في الخلفية." },
  { phase: 34, title: "ربط صفحة sync القديمة بصفحات السحابة الجديدة", status: "done", note: "ربط فحص التخزين والنسخ الاحتياطي مع المدرسة والدبلوم." },
  { phase: 38, title: "فصل أدوات المدرسة عن مركز الدبلوم", status: "done", note: "cloud-health للمدرسة و cloud-health12 لمركز الدبلوم." },
  { phase: 39, title: "فحص الصلاحيات والربط", status: "done", note: "مراجعة المستخدم والدور والمحافظة والارتباط بالمدرسة أو المركز." },
  { phase: 41, title: "لوحة الجاهزية التجارية", status: "done", note: "مراجعة حالة النظام قبل التسليم التجاري." },
  { phase: 42, title: "سجل العمليات", status: "done", note: "تسجيل فتح الصفحات والضغط على الأزرار الحساسة." },
  { phase: 45, title: "سجل العمليات السحابي", status: "needs-test", note: "يحتاج نشر قواعد Firestore والتأكد من ظهور السجلات من أكثر من جهاز." },
  { phase: 46, title: "سجل الأخطاء المركزي", status: "needs-test", note: "يحتاج تجربة أخطاء فعلية والتأكد من ظهورها في صفحة مالك المنصة." },
  { phase: 47, title: "مركز مراقبة النظام", status: "done", note: "مؤشرات عامة لحالة النظام والسحابة والكاش." },
  { phase: 48, title: "مركز صيانة النظام", status: "done", note: "تنظيف الكاش المحلي وتصدير تقرير الصيانة بدون حذف بيانات السحابة." },
  { phase: 49, title: "مركز الإصدارات والتطوير", status: "done", note: "تجميع مراحل التطوير وحالة النسخة وخطة الاختبار القادمة." },
  { phase: 50, title: "حزمة الاختبار التجاري النهائية", status: "next", note: "المرحلة القادمة: قائمة اختبار رسمية لكل الأدوار والصفحات قبل التسليم." },
];

function readSafe(storage: Storage | undefined, key: string): string {
  try {
    if (!storage) return "";
    return String(storage.getItem(key) || "");
  } catch {
    return "";
  }
}

function listKeysSafe(storage: Storage | undefined): string[] {
  try {
    if (!storage) return [];
    return Array.from({ length: storage.length }, (_, i) => storage.key(i) || "").filter(Boolean).sort();
  } catch {
    return [];
  }
}

function Badge({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "green" | "red" | "blue" | "gray" }) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    gold: { bg: "#fff7d6", border: "#d4af37", color: "#5b4100" },
    green: { bg: "#dcfce7", border: "#16a34a", color: "#14532d" },
    red: { bg: "#fee2e2", border: "#dc2626", color: "#7f1d1d" },
    blue: { bg: "#dbeafe", border: "#2563eb", color: "#1e3a8a" },
    gray: { bg: "#f1f5f9", border: "#94a3b8", color: "#334155" },
  };
  const c = colors[tone];
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color, borderRadius: 999, padding: "7px 12px", fontWeight: 1000, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </span>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={{ background: CARD, border: `2px solid ${LINE}`, borderRadius: 24, padding: 20, boxShadow: "0 10px 24px rgba(122,90,8,0.10)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: INK, fontSize: 24, fontWeight: 1000 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Button({ children, onClick, tone = "gold" }: { children: React.ReactNode; onClick: () => void; tone?: "gold" | "blue" | "red" | "green" }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    gold: { bg: "#f7d66b", color: "#111827", border: "#b7952b" },
    blue: { bg: "#dbeafe", color: "#1e3a8a", border: "#2563eb" },
    green: { bg: "#dcfce7", color: "#14532d", border: "#16a34a" },
    red: { bg: "#fee2e2", color: "#7f1d1d", border: "#dc2626" },
  };
  const c = colors[tone];
  return (
    <button onClick={onClick} style={{ border: `2px solid ${c.border}`, background: c.bg, color: c.color, borderRadius: 14, padding: "11px 16px", fontWeight: 1000, cursor: "pointer", minHeight: 44 }}>
      {children}
    </button>
  );
}

export default function SystemReleaseCenter() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    const localKeys = listKeysSafe(typeof window !== "undefined" ? window.localStorage : undefined);
    const sessionKeys = listKeysSafe(typeof window !== "undefined" ? window.sessionStorage : undefined);
    const role = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "effectiveRole") || readSafe(typeof window !== "undefined" ? window.sessionStorage : undefined, "effectiveRole");
    const tenantId = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "tenantId") || readSafe(typeof window !== "undefined" ? window.sessionStorage : undefined, "tenantId");
    const governorate = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "governorate") || readSafe(typeof window !== "undefined" ? window.sessionStorage : undefined, "governorate");
    const lastSuccess = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "exam-manager:cloud-storage:last-success-at");
    const lastWarning = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "exam-manager:cloud-storage:last-warning");
    const lastError = readSafe(typeof window !== "undefined" ? window.localStorage : undefined, "exam-manager:cloud-storage:last-error");

    return {
      releaseName: RELEASE_NAME,
      releaseCode: RELEASE_CODE,
      currentPhase: CURRENT_PHASE,
      generatedAt: new Date().toISOString(),
      session: { role, tenantId, governorate },
      cloud: { lastSuccess, lastWarning, lastError },
      storageSummary: {
        localStorageKeys: localKeys.length,
        sessionStorageKeys: sessionKeys.length,
        cloudCacheKeys: localKeys.filter((k) => k.includes("cloud-cache")).length,
        auditKeys: localKeys.filter((k) => k.toLowerCase().includes("audit")).length,
        errorKeys: localKeys.filter((k) => k.toLowerCase().includes("error")).length,
      },
      installedPhases: releaseItems.filter((item) => item.status !== "next").map((item) => item.phase),
      nextPhase: releaseItems.find((item) => item.status === "next")?.phase || null,
    };
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `release-center-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const doneCount = releaseItems.filter((item) => item.status === "done").length;
  const needsTestCount = releaseItems.filter((item) => item.status === "needs-test").length;
  const nextCount = releaseItems.filter((item) => item.status === "next").length;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${PAPER} 0%, #efe4c8 100%)`, padding: 28, color: INK, fontFamily: "Tahoma, Arial, sans-serif" }}>
      <header style={{ background: "rgba(255,250,240,0.92)", border: `3px solid ${GOLD}`, borderRadius: 28, padding: 28, marginBottom: 24, boxShadow: "0 16px 35px rgba(122,90,8,0.12)", position: "relative" }}>
        <Button onClick={() => navigate("/system")} tone="gold">العودة</Button>
        <div style={{ textAlign: "center" }}>
          <img src={MINISTRY_LOGO_URL} alt="logo" style={{ width: 92, height: 92, objectFit: "contain", marginBottom: 10 }} />
           <div style={{ color: INK, fontWeight: 1000, fontSize: 20 }}>سلطنة عمان</div>
          <div style={{ color: INK, fontWeight: 1000, fontSize: 20 }}>وزارة التعليم</div>
          <div style={{ color: MUTED, fontWeight: 900, marginTop: 4 }}>نظام إدارة الامتحانات المطور</div>
          <h1 style={{ margin: "20px 0 8px", fontSize: 52, lineHeight: 1.1, fontWeight: 1000, color: INK }}>مركز الإصدارات والتطوير</h1>
          <p style={{ margin: 0, color: MUTED, fontWeight: 900, fontSize: 17 }}>متابعة مراحل التطوير، حالة النسخة الحالية، وتجهيز المرحلة القادمة قبل التسليم التجاري.</p>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 22 }}>
        <Card title="المرحلة الحالية"><div style={{ fontSize: 40, fontWeight: 1000, color: GOLD_DARK }}>{CURRENT_PHASE}</div><div style={{ color: MUTED, fontWeight: 900 }}>{RELEASE_CODE}</div></Card>
        <Card title="المراحل المثبتة"><div style={{ fontSize: 40, fontWeight: 1000, color: "#14532d" }}>{doneCount}</div><div style={{ color: MUTED, fontWeight: 900 }}>جاهزة للاختبار</div></Card>
        <Card title="تحتاج اختبار"><div style={{ fontSize: 40, fontWeight: 1000, color: "#92400e" }}>{needsTestCount}</div><div style={{ color: MUTED, fontWeight: 900 }}>خاصة بالسجل السحابي</div></Card>
        <Card title="المرحلة القادمة"><div style={{ fontSize: 40, fontWeight: 1000, color: "#1e3a8a" }}>{nextCount ? 50 : "—"}</div><div style={{ color: MUTED, fontWeight: 900 }}>حزمة الاختبار التجاري</div></Card>
      </section>

      <Card
        title="حالة النسخة الحالية"
        right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button onClick={copyReport} tone="blue">{copied ? "تم النسخ" : "نسخ تقرير النسخة"}</Button><Button onClick={exportJson} tone="green">تصدير JSON</Button></div>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, background: "#fffdf7" }}><b>اسم النسخة:</b><br />{RELEASE_NAME}</div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, background: "#fffdf7" }}><b>آخر مزامنة:</b><br />{report.cloud.lastSuccess || "غير مسجلة"}</div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, background: "#fffdf7" }}><b>مفاتيح التخزين المحلي:</b><br />{report.storageSummary.localStorageKeys}</div>
        </div>
      </Card>

      <div style={{ height: 18 }} />

      <Card title="خريطة مراحل التطوير">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, color: INK, fontWeight: 900 }}>
            <thead>
              <tr style={{ background: "#ead98d", color: INK }}>
                <th style={{ padding: 12, border: `1px solid ${LINE}` }}>المرحلة</th>
                <th style={{ padding: 12, border: `1px solid ${LINE}` }}>العنوان</th>
                <th style={{ padding: 12, border: `1px solid ${LINE}` }}>الحالة</th>
                <th style={{ padding: 12, border: `1px solid ${LINE}` }}>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {releaseItems.map((item) => (
                <tr key={item.phase} style={{ background: item.phase === CURRENT_PHASE ? "#fff7d6" : "#fffdf7" }}>
                  <td style={{ padding: 12, border: `1px solid ${LINE}`, textAlign: "center", fontWeight: 1000 }}>{item.phase}</td>
                  <td style={{ padding: 12, border: `1px solid ${LINE}` }}>{item.title}</td>
                  <td style={{ padding: 12, border: `1px solid ${LINE}` }}>
                    {item.status === "done" ? <Badge tone="green">مثبتة</Badge> : item.status === "needs-test" ? <Badge tone="gold">تحتاج اختبار</Badge> : <Badge tone="blue">القادمة</Badge>}
                  </td>
                  <td style={{ padding: 12, border: `1px solid ${LINE}`, color: MUTED }}>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 18 }} />

      <Card title="روابط سريعة للمرحلة التجارية">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button onClick={() => navigate("/system/monitoring")} tone="green">مركز مراقبة النظام</Button>
          <Button onClick={() => navigate("/system/maintenance")} tone="gold">مركز الصيانة</Button>
          <Button onClick={() => navigate("/system/error-log")} tone="red">سجل الأخطاء</Button>
          <Button onClick={() => navigate("/system/audit-log")} tone="blue">سجل العمليات</Button>
          <Button onClick={() => navigate("/system/permissions-audit")} tone="gold">فحص الصلاحيات</Button>
          <Button onClick={() => navigate("/system/commercial-readiness")} tone="green">الجاهزية التجارية</Button>
        </div>
      </Card>
    </div>
  );
}
