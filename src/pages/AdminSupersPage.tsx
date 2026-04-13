import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import {
  buildAuthzSnapshot,
  canAccessCapability,
} from "../features/authz";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { MINISTRY_SCOPE } from "../constants/directorates";
import { Button, Card, LINE } from "../features/system-admin/ui";
import AdminSuperUsersSection from "../features/system-admin/components/AdminSuperUsersSection";
import {
  createAllowUserAction,
  removeAllowUserAction,
} from "../features/system-admin/services/adminUsersService";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

export default function AdminSupersPage() {
  const { user, profile, isSuperAdmin, isSuper, logout } = useAuth() as any;
  const navigate = useNavigate();

  const authzSnapshot = useMemo(
    () => buildAuthzSnapshot({ user, profile, isSuperAdmin, isSuper }),
    [user, profile, isSuperAdmin, isSuper]
  );

  const isPlatformOwner = canAccessCapability(authzSnapshot, "PLATFORM_OWNER");

  const [superEmail, setSuperEmail] = useState<string>("");
  const [superName, setSuperName] = useState<string>("");
  const [superRole, setSuperRole] = useState<string>("super");
  const [superGovernorate, setSuperGovernorate] = useState<string>("");
  const [superEnabled, setSuperEnabled] = useState(true);
  const [supers, setSupers] = useState<any[]>([]);

  if (!user) return <Navigate to="/login" replace />;
  if (!isPlatformOwner) return <Navigate to="/system" replace />;

  const loadSupers = async () => {
    const superSnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "super")));
    const ministrySnap = await getDocs(query(collection(db, "allowlist"), where("role", "==", "ministry_super")));

    const rows = [
      ...superSnap.docs.map((d: any) => ({ email: d.id, ...(d.data() as any) })),
      ...ministrySnap.docs.map((d: any) => ({ email: d.id, ...(d.data() as any) })),
    ].sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));

    setSupers(rows);
  };

  useEffect(() => {
    void loadSupers();
  }, []);

  const canCreateSuperUser = useMemo(() => {
    const email = String(superEmail || "").trim().toLowerCase();
    if (!isPlatformOwner) return false;
    if (!email.includes("@")) return false;
    if (!["super", "ministry_super"].includes(String(superRole || "").trim())) return false;
    if (String(superRole || "").trim() === "super" && !String(superGovernorate || "").trim()) return false;
    return true;
  }, [isPlatformOwner, superEmail, superRole, superGovernorate]);

  const createSuperUser = async () => {
    if (!user || !canCreateSuperUser) return;

    const role = String(superRole || "").trim();
    const governorate = role === "ministry_super" ? MINISTRY_SCOPE : String(superGovernorate || "").trim();

    try {
      await createAllowUserAction({
        user,
        authzSnapshot,
        isSuper,
        profile,
        users: [],
        newUserEmail: superEmail,
        newUserTenantId: "system",
        newUserRole: role,
        newUserGovernorate: governorate,
        newUserEnabled: superEnabled,
        newUserName: superName,
        newUserSchoolName: "",
        selectedTenantConfig: {},
      });

      setSuperEmail("");
      setSuperName("");
      setSuperRole("super");
      setSuperGovernorate("");
      setSuperEnabled(true);

      await loadSupers();
      alert("تم حفظ السوبر بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ السوبر."));
    }
  };

  const removeSuperUser = async (email: string) => {
    if (!user) return;
    const ok = window.confirm(`هل تريد حذف السوبر: ${email} ؟`);
    if (!ok) return;

    try {
      await removeAllowUserAction({ user, users: [], authzSnapshot, email });
      await loadSupers();
      alert("تم حذف السوبر بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حذف السوبر."));
    }
  };

  return (
    <div className="system-shell">
      <header className="system-header">
        <div className="system-header-inner">
          <div className="system-brand">
            <img src={MINISTRY_LOGO_URL} alt="logo" />
            <div className="system-brand-title">وزارة التعليم</div>
          </div>

          <div className="system-program">إدارة السوبرات</div>

          <div className="system-actions">
            {user?.email ? <span style={{ opacity: 0.75 }}>({String(user.email)})</span> : null}
            <Button variant="ghost" onClick={() => navigate("/system")} style={{ padding: "8px 10px" }}>
              العودة إلى لوحة مالك المنصة
            </Button>
            <Button variant="ghost" onClick={logout} style={{ padding: "8px 10px" }}>
              تسجيل خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="system-main">
        <div
          className="system-glow"
          style={{
            borderRadius: 22,
            padding: 18,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.62), rgba(0,0,0,0.35)), repeating-linear-gradient(135deg, rgba(212,175,55,0.14) 0px, rgba(212,175,55,0.14) 1px, transparent 1px, transparent 22px)",
            border: `1px solid ${LINE}`,
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <Card title="صفحة مستقلة لإدارة سوبر المحافظات وسوبر الوزارة">
              <div style={{ color: "#e5e7eb", lineHeight: 1.9 }}>
                هذه الصفحة مستقلة عن لوحة مالك المنصة، ومخصصة فقط لإدارة:
                <br />
                - سوبر المحافظات
                <br />
                - سوبر الوزارة
              </div>
            </Card>

            <AdminSuperUsersSection
              superEmail={superEmail}
              setSuperEmail={setSuperEmail}
              superName={superName}
              setSuperName={setSuperName}
              superRole={superRole}
              setSuperRole={setSuperRole}
              superGovernorate={superGovernorate}
              setSuperGovernorate={setSuperGovernorate}
              superEnabled={superEnabled}
              setSuperEnabled={setSuperEnabled}
              createSuperUser={createSuperUser}
              canCreateSuperUser={canCreateSuperUser}
              supers={supers}
              removeSuperUser={removeSuperUser}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
