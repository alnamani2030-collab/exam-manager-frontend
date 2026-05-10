// src/pages/SystemCommercialTestSuite.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type TestItem = {
  id: string;
  title: string;
  target: string;
  expected: string;
  path?: string;
  level: "critical" | "important" | "normal";
};

function readStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.sessionStorage.getItem(key) || window.localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function listLocalKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys.sort();
  } catch {
    return [];
  }
}

function isReadOnlyActive(): boolean {
  return ["governorateSuperReadOnly", "viewAsReadOnly", "readOnly"].some((key) => {
    const value = readStorage(key).toLowerCase();
    return value === "true" || value === "1" || value === "yes";
  });
}

function getTenantId(): string {
  return (
    readStorage("effectiveTenantId") ||
    readStorage("selectedTenantId") ||
    readStorage("tenantId") ||
    readStorage("governorateSuperViewTenantId") ||
    "azaan2090"
  );
}

export default function SystemCommercialTestSuite() {
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin, isSuper } = useAuth() as any;
  const [filter, setFilter] = useState<"all" | "critical" | "important" | "normal">("all");
  const [query, setQuery] = useState("");

  const tenantId = getTenantId();
  const role = String(profile?.role || (isSuperAdmin ? "super_admin" : isSuper ? "super" : "user") || "user").trim();
  const governorate = String(profile?.governorate || profile?.tenantGovernorate || readStorage("governorateSuperGovernorate") || "").trim();
  const readOnly = isReadOnlyActive();
  const keys = useMemo(() => listLocalKeys(), []);
  const cloudCacheKeys = keys.filter((k) => k.includes("cloud-cache")).length;
  const cloudStorageKeys = keys.filter((k) => k.includes("cloud-storage")).length;

  const tests: TestItem[] = useMemo(() => [
    {
      id: "owner-system",
      title: "مالك المنصة — الدخول إلى لوحة النظام",
      target: "مالك المنصة",
      expected: "يظهر كل شيء: المدارس، المستخدمون، المحافظات، السجلات، الصيانة، المراقبة.",
      path: "/system",
      level: "critical",
    },
    {
      id: "permissions-audit",
      title: "فحص الصلاحيات والربط",
      target: "مالك المنصة / مشرف المحافظة",
      expected: "تظهر المستخدمون داخل النطاق فقط، مع توضيح المدرسة أو مركز الدبلوم وحالة التفعيل.",
      path: "/system/permissions-audit",
      level: "critical",
    },
    {
      id: "governorate-super-system",
      title: "مشرف المحافظة — صفحة الإشراف",
      target: "مشرف المحافظة",
      expected: "يرى محافظته فقط، ويستطيع إضافة أدمن مدرسة وسوبر امتحانات داخل نفس المحافظة.",
      path: "/super-system",
      level: "critical",
    },
    {
      id: "school-admins-readonly",
      title: "دخول مشرف المحافظة إلى أدمن المدرسة",
      target: "مشرف المحافظة",
      expected: "يفتح جميع صفحات المدرسة بوضع مشاهدة فقط، بدون حفظ أو حذف أو استيراد.",
      path: "/school-admins",
      level: "critical",
    },
    {
      id: "exam-supers-readonly",
      title: "دخول مشرف المحافظة إلى مركز الدبلوم",
      target: "مشرف المحافظة",
      expected: "يفتح جميع صفحات مركز الدبلوم بوضع مشاهدة فقط، وداخل Layout12 وليس Layout المدرسة.",
      path: "/exam-supers",
      level: "critical",
    },
    {
      id: "school-cloud-health",
      title: "فحص التخزين السحابي للمدرسة",
      target: "أدمن المدرسة",
      expected: "يفتح داخل Layout المدرسة، ويعرض القراءة والكتابة والكاش بوضوح.",
      path: `/t/${tenantId}/cloud-health`,
      level: "important",
    },
    {
      id: "diploma-cloud-health",
      title: "فحص التخزين السحابي لمركز الدبلوم",
      target: "سوبر الامتحانات",
      expected: "يفتح داخل Layout12، وليس Layout المدرسة.",
      path: `/t/${tenantId}/cloud-health12`,
      level: "important",
    },
    {
      id: "school-backup",
      title: "النسخ الاحتياطي السحابي للمدرسة",
      target: "أدمن المدرسة",
      expected: "يمكن تصدير نسخة احتياطية، والاستعادة ممنوعة عند المشاهدة فقط.",
      path: `/t/${tenantId}/cloud-backup`,
      level: "important",
    },
    {
      id: "diploma-backup",
      title: "النسخ الاحتياطي السحابي لمركز الدبلوم",
      target: "سوبر الامتحانات",
      expected: "يفتح داخل Layout12، مع حماية وضع المشاهدة فقط.",
      path: `/t/${tenantId}/cloud-backup12`,
      level: "important",
    },
    {
      id: "audit-log",
      title: "سجل العمليات السحابي",
      target: "مالك المنصة / مشرف المحافظة",
      expected: "يسجل فتح الصفحات والأزرار والإجراءات الحساسة محليًا وسحابيًا.",
      path: "/system/audit-log",
      level: "important",
    },
    {
      id: "error-log",
      title: "سجل الأخطاء المركزي",
      target: "مالك المنصة",
      expected: "يسجل الأخطاء والتحذيرات المهمة ويعرضها في صفحة واحدة.",
      path: "/system/error-log",
      level: "important",
    },
    {
      id: "monitoring",
      title: "مركز مراقبة النظام",
      target: "مالك المنصة",
      expected: "يعرض حالة النظام، آخر مزامنة، الكاش، السجلات، والروابط المهمة.",
      path: "/system/monitoring",
      level: "normal",
    },
    {
      id: "maintenance",
      title: "مركز صيانة النظام",
      target: "مالك المنصة",
      expected: "ينظف الكاش المحلي فقط بدون حذف بيانات Firestore.",
      path: "/system/maintenance",
      level: "normal",
    },
    {
      id: "release-center",
      title: "مركز الإصدارات والتطوير",
      target: "مالك المنصة",
      expected: "يعرض مراحل التطوير والمرحلة الحالية والقادمة.",
      path: "/system/release-center",
      level: "normal",
    },
  ], [tenantId]);

  const visibleTests = tests.filter((item) => {
    const levelMatch = filter === "all" || item.level === filter;
    const q = query.trim().toLowerCase();
    const text = `${item.title} ${item.target} ${item.expected}`.toLowerCase();
    return levelMatch && (!q || text.includes(q));
  });

  const criticalCount = tests.filter((t) => t.level === "critical").length;
  const importantCount = tests.filter((t) => t.level === "important").length;
  const normalCount = tests.filter((t) => t.level === "normal").length;

  function exportReport() {
    const report = {
      exportedAt: new Date().toISOString(),
      user: user?.email || "",
      role,
      governorate,
      tenantId,
      readOnly,
      localStorageKeys: keys.length,
      cloudCacheKeys,
      cloudStorageKeys,
      tests,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commercial-test-suite-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyReport() {
    const text = [
      "حزمة الاختبار التجاري النهائي",
      `المستخدم: ${user?.email || "غير معروف"}`,
      `الدور: ${role}`,
      `المحافظة: ${governorate || "غير محددة"}`,
      `Tenant: ${tenantId}`,
      `وضع المشاهدة فقط: ${readOnly ? "مفعل" : "غير مفعل"}`,
      `عدد الاختبارات: ${tests.length}`,
      `اختبارات حرجة: ${criticalCount}`,
      `اختبارات مهمة: ${importantCount}`,
    ].join("\n");
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f5edda", color: "#111827", padding: 26, fontFamily: "Tajawal, Cairo, Arial, sans-serif" }}>
      <style>{`
        .phase50-card{background:rgba(255,255,255,.72);border:2px solid #c9a227;border-radius:24px;box-shadow:0 16px 40px rgba(111,85,17,.10);}
        .phase50-btn{border:2px solid #b8941f;border-radius:14px;background:#fff7df;color:#111827;font-weight:900;padding:10px 16px;cursor:pointer;}
        .phase50-btn:hover{background:#f7e8b5;}
        .phase50-input{width:100%;border:2px solid #e0c467;border-radius:14px;background:#fff;color:#111827;font-weight:900;padding:12px 14px;outline:none;}
        .phase50-table{width:100%;border-collapse:collapse;background:#fffdf5;border-radius:18px;overflow:hidden;}
        .phase50-table th{background:#eadb99;color:#111827;font-weight:1000;padding:12px;border-bottom:1px solid #ceb24f;}
        .phase50-table td{padding:12px;border-bottom:1px solid #efe3b7;color:#111827;font-weight:800;vertical-align:top;}
        .phase50-badge{display:inline-flex;border-radius:999px;padding:6px 12px;font-weight:1000;border:1px solid rgba(0,0,0,.08);}
      `}</style>

      <header className="phase50-card" style={{ padding: 26, marginBottom: 22, position: "relative" }}>
        <button className="phase50-btn" onClick={() => navigate("/system")} style={{ position: "absolute", left: 24, top: 24 }}>
          العودة
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center", marginBottom: 12 }}>
          <img src={MINISTRY_LOGO_URL} alt="logo" style={{ width: 86, height: 86, objectFit: "contain", border: "2px solid #c9a227", borderRadius: 18, background: "#fff" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>سلطنة عمان</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>وزارة التعليم</div>
          <h1 style={{ margin: "12px 0 8px", fontSize: 46, fontWeight: 1000 }}>حزمة الاختبار التجاري النهائي</h1>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>اختبارات جاهزة للتحقق من الصلاحيات، السحابة، السجلات، والمشاهدة فقط قبل التسليم.</p>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        {[
          [tests.length, "إجمالي الاختبارات"],
          [criticalCount, "اختبارات حرجة"],
          [importantCount, "اختبارات مهمة"],
          [readOnly ? "مفعل" : "غير مفعل", "وضع المشاهدة فقط"],
        ].map(([value, label]) => (
          <div key={String(label)} className="phase50-card" style={{ padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{String(value)}</div>
            <div style={{ fontWeight: 900 }}>{String(label)}</div>
          </div>
        ))}
      </section>

      <section className="phase50-card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr .8fr auto auto", gap: 12, alignItems: "end" }}>
          <label style={{ fontWeight: 1000 }}>
            بحث
            <input className="phase50-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم الاختبار أو الدور..." />
          </label>
          <label style={{ fontWeight: 1000 }}>
            مستوى الاختبار
            <select className="phase50-input" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">كل الاختبارات</option>
              <option value="critical">حرج</option>
              <option value="important">مهم</option>
              <option value="normal">عادي</option>
            </select>
          </label>
          <button className="phase50-btn" onClick={copyReport}>نسخ التقرير</button>
          <button className="phase50-btn" onClick={exportReport}>تصدير JSON</button>
        </div>
      </section>

      <section className="phase50-card" style={{ padding: 20, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>بيانات الجلسة الحالية</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}>
          {[
            [user?.email || "غير معروف", "المستخدم"],
            [role, "الدور"],
            [governorate || "غير محددة", "المحافظة"],
            [tenantId, "Tenant"],
            [`${keys.length} مفتاح`, "localStorage"],
          ].map(([value, label]) => (
            <div key={String(label)} style={{ border: "1px solid #d8bd54", borderRadius: 16, padding: 12, background: "#fffdf5" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#6b5b19" }}>{String(label)}</div>
              <div style={{ fontSize: 16, fontWeight: 1000, overflowWrap: "anywhere" }}>{String(value)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="phase50-card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>قائمة الاختبارات</h2>
        <table className="phase50-table">
          <thead>
            <tr>
              <th>المستوى</th>
              <th>الاختبار</th>
              <th>الدور المستهدف</th>
              <th>النتيجة المتوقعة</th>
              <th>فتح</th>
            </tr>
          </thead>
          <tbody>
            {visibleTests.length ? visibleTests.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="phase50-badge" style={{ background: item.level === "critical" ? "#fee2e2" : item.level === "important" ? "#fef3c7" : "#dcfce7", color: "#111827" }}>
                    {item.level === "critical" ? "حرج" : item.level === "important" ? "مهم" : "عادي"}
                  </span>
                </td>
                <td>{item.title}</td>
                <td>{item.target}</td>
                <td>{item.expected}</td>
                <td>{item.path ? <button className="phase50-btn" onClick={() => navigate(item.path!)}>فتح</button> : "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 28 }}>لا توجد اختبارات مطابقة.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
