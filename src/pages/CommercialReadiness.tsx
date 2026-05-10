// src/pages/CommercialReadiness.tsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const clean = (value: unknown) => String(value || "").trim();
const roleOf = (auth: any) =>
  clean(
    auth?.effectiveRole ||
      auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      auth?.role ||
      "",
  );

const tenantOf = (auth: any) =>
  clean(
    auth?.effectiveTenantId ||
      auth?.allow?.tenantId ||
      auth?.profile?.tenantId ||
      auth?.userProfile?.tenantId ||
      auth?.tenantId ||
      "",
  );

const governorateOf = (auth: any) =>
  clean(
    auth?.effectiveGovernorate ||
      auth?.allow?.governorate ||
      auth?.profile?.governorate ||
      auth?.userProfile?.governorate ||
      auth?.governorate ||
      "",
  );

const emailOf = (auth: any) =>
  clean(
    auth?.user?.email ||
      auth?.email ||
      auth?.allow?.email ||
      auth?.profile?.email ||
      auth?.userProfile?.email ||
      "",
  );

const getLocalStats = () => {
  if (typeof window === "undefined") {
    return { total: 0, cloudCache: 0, cloudStatus: 0, tenantKeys: 0 };
  }

  const keys = Object.keys(window.localStorage || {});
  return {
    total: keys.length,
    cloudCache: keys.filter((k) => k.includes("cloud-cache")).length,
    cloudStatus: keys.filter((k) => k.includes("cloud-storage")).length,
    tenantKeys: keys.filter((k) => k.includes("exam-manager") || k.includes("tenant")).length,
  };
};

const getReadonlyFlag = () => {
  if (typeof window === "undefined") return false;
  const value =
    window.sessionStorage.getItem("exam-manager:view-as-readonly") ||
    window.sessionStorage.getItem("exam-manager:viewAsReadOnly") ||
    window.localStorage.getItem("exam-manager:view-as-readonly") ||
    "";
  return ["1", "true", "yes", "readonly"].includes(value.toLowerCase());
};

type CheckStatus = "ok" | "warn" | "info";

function StatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; bg: string; color: string; border: string }> = {
    ok: { label: "جاهز", bg: "#ecfdf5", color: "#065f46", border: "#16a34a" },
    warn: { label: "يحتاج مراجعة", bg: "#fff7ed", color: "#9a3412", border: "#f59e0b" },
    info: { label: "معلومة", bg: "#eff6ff", color: "#1d4ed8", border: "#3b82f6" },
  };
  const item = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${item.border}`,
        background: item.bg,
        color: item.color,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {item.label}
    </span>
  );
}

function OfficialButton({ children, onClick, variant = "gold" }: { children: React.ReactNode; onClick: () => void; variant?: "gold" | "white" | "dark" }) {
  const styles = {
    gold: { background: "#b8941f", color: "#111827", border: "#9f7d13" },
    white: { background: "#fffaf0", color: "#111827", border: "#c8a62a" },
    dark: { background: "#111827", color: "#ffffff", border: "#111827" },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        borderRadius: 14,
        padding: "12px 18px",
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
      }}
    >
      {children}
    </button>
  );
}

function CheckCard({ title, desc, status }: { title: string; desc: string; status: CheckStatus }) {
  return (
    <div
      style={{
        border: "2px solid #c8a62a",
        borderRadius: 20,
        background: "rgba(255,250,240,0.92)",
        padding: 18,
        minHeight: 130,
        boxShadow: "0 14px 28px rgba(120,88,0,0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "#111827", fontSize: 19, fontWeight: 950 }}>{title}</h3>
        <StatusBadge status={status} />
      </div>
      <p style={{ margin: "14px 0 0", color: "#111827", fontSize: 15, fontWeight: 800, lineHeight: 1.9 }}>
        {desc}
      </p>
    </div>
  );
}

export default function CommercialReadiness() {
  const navigate = useNavigate();
  const auth = useAuth() as any;

  const role = roleOf(auth);
  const email = emailOf(auth);
  const tenantId = tenantOf(auth);
  const governorate = governorateOf(auth);
  const isReadonly = getReadonlyFlag();

  const stats = useMemo(() => getLocalStats(), []);
  const roleLower = role.toLowerCase();
  const isOwner = ["owner", "super_admin", "superadmin", "platform_owner", "مالك المنصة"].includes(roleLower);
  const isGovernorateSuper = ["super", "governorate_super", "governorate-super", "سوبر المحافظة", "مشرف المحافظة"].includes(roleLower);

  const checks = [
    {
      title: "هوية المستخدم",
      desc: email ? `تم التعرف على المستخدم الحالي: ${email}` : "لا يظهر بريد المستخدم الحالي بوضوح. راجع جلسة تسجيل الدخول.",
      status: email ? "ok" : "warn",
    },
    {
      title: "نوع الصلاحية",
      desc: role ? `الصلاحية الحالية: ${role}` : "لم يتم العثور على دور واضح للمستخدم الحالي.",
      status: role ? "ok" : "warn",
    },
    {
      title: "نطاق المحافظة",
      desc: governorate ? `النطاق الحالي مرتبط بـ: ${governorate}` : "لا يوجد نطاق محافظة واضح. هذا مهم لمشرف المحافظة.",
      status: governorate || isOwner ? "ok" : "warn",
    },
    {
      title: "وضع المشاهدة فقط",
      desc: isReadonly ? "الجلسة الحالية مفعّل عليها وضع المشاهدة فقط." : "لا يوجد وضع مشاهدة فقط مفعّل في هذه اللحظة.",
      status: isReadonly ? "ok" : "info",
    },
    {
      title: "مفاتيح التخزين المحلي",
      desc: `إجمالي المفاتيح المحلية: ${stats.total}، مفاتيح البرنامج: ${stats.tenantKeys}، كاش السحابة: ${stats.cloudCache}.`,
      status: stats.total >= 0 ? "ok" : "warn",
    },
    {
      title: "جاهزية الدور التجاري",
      desc: isOwner
        ? "مالك المنصة مؤهل لفحص كل المحافظات والصفحات الإدارية."
        : isGovernorateSuper
          ? "مشرف المحافظة يجب أن يرى محافظته فقط ويفتح المدارس ومراكز الدبلوم مشاهدة فقط."
          : "المستخدم الحالي ليس مالك منصة أو مشرف محافظة، لذلك استخدم صفحات الفحص من داخل النطاق فقط.",
      status: isOwner || isGovernorateSuper ? "ok" : "info",
    },
  ] as Array<{ title: string; desc: string; status: CheckStatus }>;

  const primaryTenant = tenantId || "azaan2090";

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f4edda", padding: 30, color: "#111827" }}>
      <section
        style={{
          border: "3px solid #b8941f",
          borderRadius: 28,
          background: "linear-gradient(135deg,#fffaf0,#f7edd2)",
          padding: 26,
          boxShadow: "0 22px 45px rgba(120,88,0,0.16)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img
              src={MINISTRY_LOGO_URL}
              alt="وزارة التعليم"
              style={{ width: 92, height: 92, objectFit: "contain", border: "2px solid #c8a62a", borderRadius: 18, background: "#fff" }}
            />
            <div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>سلطنة عمان</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>وزارة التعليم</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#3f3f46" }}>{governorate || "نظام إدارة الامتحانات المطور"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <OfficialButton variant="white" onClick={() => navigate("/super-system")}>العودة لمشرف المحافظة</OfficialButton>
            <OfficialButton variant="white" onClick={() => navigate("/system")}>لوحة مالك المنصة</OfficialButton>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <h1 style={{ margin: 0, fontSize: 46, fontWeight: 950, color: "#111827", letterSpacing: -1 }}>
            لوحة الجاهزية التجارية
          </h1>
          <p style={{ margin: "14px auto 0", maxWidth: 880, fontSize: 17, fontWeight: 850, lineHeight: 1.9 }}>
            فحص سريع لحالة الصلاحيات، المشاهدة فقط، التخزين السحابي، وروابط التشغيل قبل اعتماد النسخة التجارية.
          </p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div style={{ border: "2px solid #c8a62a", borderRadius: 18, background: "#fffaf0", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>المستخدم</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{email || "غير محدد"}</div>
        </div>
        <div style={{ border: "2px solid #c8a62a", borderRadius: 18, background: "#fffaf0", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>الصلاحية</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{role || "غير محدد"}</div>
        </div>
        <div style={{ border: "2px solid #c8a62a", borderRadius: 18, background: "#fffaf0", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>النطاق</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{governorate || "غير محدد"}</div>
        </div>
        <div style={{ border: "2px solid #c8a62a", borderRadius: 18, background: "#fffaf0", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Tenant الحالي</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{tenantId || "غير محدد"}</div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16, marginBottom: 24 }}>
        {checks.map((check) => (
          <CheckCard key={check.title} title={check.title} desc={check.desc} status={check.status} />
        ))}
      </section>

      <section
        style={{
          border: "3px solid #b8941f",
          borderRadius: 24,
          background: "rgba(255,250,240,0.92)",
          padding: 22,
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 27, fontWeight: 950 }}>روابط الفحص السريع</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <OfficialButton onClick={() => navigate("/system/permissions-audit")}>فحص الصلاحيات والربط</OfficialButton>
          <OfficialButton onClick={() => navigate("/school-admins")}>أدمنات المدارس</OfficialButton>
          <OfficialButton onClick={() => navigate("/exam-supers")}>سوبر الامتحانات</OfficialButton>
          <OfficialButton onClick={() => navigate(`/t/${primaryTenant}/cloud-health`)}>فحص سحابة المدرسة</OfficialButton>
          <OfficialButton onClick={() => navigate(`/t/${primaryTenant}/cloud-health12`)}>فحص سحابة الدبلوم</OfficialButton>
          <OfficialButton onClick={() => navigate(`/t/${primaryTenant}/cloud-backup12`)}>نسخ احتياطي للدبلوم</OfficialButton>
        </div>
      </section>

      <section
        style={{
          border: "2px solid #c8a62a",
          borderRadius: 24,
          background: "#fffaf0",
          padding: 22,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 950 }}>توصية المرحلة التالية</h2>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 850, lineHeight: 1.9 }}>
          بعد مراجعة هذه اللوحة، تكون المرحلة التالية هي إنشاء سجل عمليات مركزي يسجل: الإضافة، التعديل، الحذف، الدخول للمشاهدة فقط، تشغيل التوزيع، النسخ الاحتياطي، والاستعادة. هذا السجل مهم للنسخة التجارية ولمتابعة أي مشكلة تشغيلية.
        </p>
      </section>
    </div>
  );
}
