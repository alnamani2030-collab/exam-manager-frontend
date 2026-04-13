import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability, isPlatformOwner, resolvePrimaryRoleLabel, resolveRoleBadgeStyle } from "../features/authz";
import { buildSuperPortalCards } from "../features/super-admin/services/superPortalService";
import SuperPortalCard from "../features/super-admin/components/SuperPortalCard";
import { useI18n } from "../i18n/I18nProvider";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";


type PortalRoleLang = "ar" | "en";

function translateRoleLabel(label: string, lang: PortalRoleLang): string {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "سوبر الوزارة": { ar: "سوبر الوزارة", en: "Ministry Super" },
    "سوبر المحافظات": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "أدمن المدرسة": { ar: "أدمن المدرسة", en: "School Admin" },
    "مشرف نطاق": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مدير جهة": { ar: "أدمن المدرسة", en: "School Admin" },
    "Platform Owner": { ar: "مالك المنصة", en: "Platform Owner" },
    "Ministry Super": { ar: "سوبر الوزارة", en: "Ministry Super" },
    "Governorates Super": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "School Admin": { ar: "أدمن المدرسة", en: "School Admin" },
  };
  return map[label]?.[lang] || label;
}


export default function SuperPortal() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { profile, authzSnapshot, logout, primaryRoleLabel } = useAuth() as any;

  const displayName = useMemo(() => {
    return profile?.userName || profile?.name || profile?.email || "";
  }, [profile]);

  const roleLabel = translateRoleLabel(primaryRoleLabel || resolvePrimaryRoleLabel(authzSnapshot), (lang === "en" ? "en" : "ar") as PortalRoleLang);
  const roleBadgeBase = resolveRoleBadgeStyle(authzSnapshot);
  const roleBadge = { ...roleBadgeBase, label: translateRoleLabel(roleBadgeBase.label, (lang === "en" ? "en" : "ar") as PortalRoleLang) };
  const owner = isPlatformOwner(authzSnapshot);
  const canAccessSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");
  const isScopeAdmin = Boolean(profile?.role === "super" || profile?.role === "super_admin");

  const cards = useMemo(
    () => buildSuperPortalCards({ owner, isScopeAdmin, navigate }),
    [owner, isScopeAdmin, navigate],
  );

  if (!canAccessSystem) return <Navigate to="/" replace />;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(184, 134, 11, 0.18), transparent 55%), radial-gradient(900px 520px at 80% 15%, rgba(184, 134, 11, 0.12), transparent 60%), linear-gradient(180deg, #060606 0%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        direction: lang === "ar" ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          borderRadius: 28,
          border: "6px solid #d4af37",
          background: "rgba(0,0,0,0.55)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          backdropFilter: "blur(10px)",
          padding: 28,
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 18,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ color: "#d4af37", fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>{tr("وزارة التعليم", "Ministry of Education")}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 34, lineHeight: 1.2 }}>{tr("نظام إدارة الامتحانات المطور", "Advanced Exam Management System")}</div>
            <div style={{ color: "rgba(255,255,255,0.82)", marginTop: 8, fontSize: 16 }}>
              {tr("تم تسجيل الدخول بصلاحيات", "Signed in with role")} <b style={{ color: "#d4af37" }}>{roleBadge.label}</b>.
              {owner
                ? tr(" لديك وصول كامل بصفة مالك المنصة.", " You have full access as the platform owner.")
                : roleBadge.label === tr("سوبر الوزارة", "Ministry Super")
                ? tr(" لديك صلاحية مشاهدة فقط على مستوى الوزارة بدون دخول إلى بيانات المدارس الداخلية.", " You have ministry-level read-only access without entering internal school data.")
                : roleBadge.label === tr("سوبر المحافظات", "Governorates Super")
                ? tr(" لديك صلاحية إدارة المدارس وأدمنات المدارس داخل محافظتك فقط بدون دخول إلى البيانات الداخلية للمدرسة.", " You can manage schools and school admins inside your governorate only, without entering internal school data.")
                : tr(" يمكنك الدخول إلى مدرستك وإدارة بياناتها حسب الصلاحيات الممنوحة لك.", " You can enter your school and manage its data according to your granted permissions.")}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
            <img
              src={MINISTRY_LOGO_URL}
              alt="وزارة التعليم"
              style={{ width: "80px", height: "80px", filter: "drop-shadow(0 8px 18px rgba(212,175,55,0.25))" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginTop: 18,
          }}
        >
          {cards.map((card) => <SuperPortalCard key={card.key} card={card} />)}
        </div>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(212, 175, 55, 0.35)",
              border: "1px solid rgba(212,175,55,0.5)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 16px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
            }}
          >
            {tr("تسجيل الخروج", "Log out")}
          </button>
        </div>

        <div style={{ marginTop: 18, color: "rgba(255,255,255,0.70)", fontSize: 14 }}>
          {tr("مرحبًا", "Welcome")} <span style={{ color: "#d4af37", fontWeight: 800 }}>{displayName}</span>.
          <span style={{ marginInlineStart: 8 }}>{roleLabel}</span>
        </div>
      </div>
    </div>
  );
}
