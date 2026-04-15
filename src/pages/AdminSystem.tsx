// src/pages/AdminSystem.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import "./adminSystem.theme.css";
import AdminTenantsSection from "../features/system-admin/components/AdminTenantsSection";
import AdminUsersSection from "../features/system-admin/components/AdminUsersSection";
import AdminOwnerToolsSection from "../features/system-admin/components/AdminOwnerToolsSection";
import { Button, Card, GOLD, Input, LINE } from "../features/system-admin/ui";

// شعار وزارة التعليم
const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const USE_FUNCTIONS = !Boolean((import.meta as any).env?.DEV);

import { auth, db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  canManageAdminSystemRole,
  resolvePrimaryRoleLabel,
} from "../features/authz";
import { callFn } from "../services/functionsClient";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { useAdminTenants } from "../features/system-admin/hooks/useAdminTenants";
import { useAdminUsers } from "../features/system-admin/hooks/useAdminUsers";
import type { AllowUser } from "../features/system-admin/types";
import {
  createTenantAction,
  deleteTenantAction,
  saveTenantConfigAction,
  toggleTenantEnabledAction,
} from "../features/system-admin/services/adminTenantsService";
import {
  createAllowUserAction,
  inviteSingleOwnerAction,
  loadOwnerForTenantAction,
  removeAllowUserAction,
  updateAllowUserAction,
} from "../features/system-admin/services/adminUsersService";
import {
  isValidTenantId,
  normalizeRoleClient,
  resolveTenantGovernorate,
} from "../features/system-admin/services/adminSystemShared";

export default function AdminSystem() {
  const { user, profile, isSuperAdmin, isSuper, canSupport, startSupportForTenant, logout } =
    useAuth() as any;
  const navigate = useNavigate();

  const authzSnapshot = useMemo(
    () => buildAuthzSnapshot({ user, profile, isSuperAdmin, isSuper }),
    [user, profile, isSuperAdmin, isSuper]
  );
  const roleLabel = resolvePrimaryRoleLabel(authzSnapshot);
  const isPlatformOwner = canAccessCapability(authzSnapshot, "PLATFORM_OWNER");
  const canManageUsers = canAccessCapability(authzSnapshot, "USERS_MANAGE");

  const {
    visibleTenants,
    selectedTenantId,
    setSelectedTenantId,
    selectedTenantConfig,
    setSelectedTenantConfig,
    loadingConfig,
    newTenantName,
    setNewTenantName,
    newTenantIdRaw,
    setNewTenantIdRaw,
    newTenantId,
    newTenantEnabled,
    setNewTenantEnabled,
    canSaveTenant,
  } = useAdminTenants({ isPlatformOwner, isSuper, profile });

  const [ownerTenantId, setOwnerTenantId] = useState<string>("");
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [ownerDoc, setOwnerDoc] = useState<any | null>(null);
  const [ownerDocLoading, setOwnerDocLoading] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);

  const {
    newUserEmail,
    setNewUserEmail,
    newUserName,
    setNewUserName,
    newUserSchoolName,
    setNewUserSchoolName,
    newUserTenantId,
    setNewUserTenantId,
    newUserRole,
    setNewUserRole,
    newUserGovernorate,
    setNewUserGovernorate,
    newUserEnabled,
    setNewUserEnabled,
    users,
    filteredUsers,
    editDrafts,
    setDraft,
    clearDraft,
    search,
    setSearch,
  } = useAdminUsers();

  const [supportError, setSupportError] = useState<string>("");

  useEffect(() => {
    const q = query(collection(db, "systemSuggestions"), where("status", "==", "new"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setHasNewSuggestions(!snap.empty);
      },
      (error) => {
        console.error("systemSuggestions listener error:", error);
        setHasNewSuggestions(false);
      }
    );

    return () => unsub();
  }, []);

  const [refreshingPerms, setRefreshingPerms] = useState(false);
  async function refreshMyPermissions() {
    try {
      setRefreshingPerms(true);
      if (USE_FUNCTIONS) {
        const fn = callFn<any, any>("syncMyClaims");
        await fn({});
      }
    } catch {
        // ignore
    } finally {
      try {
        await auth.currentUser?.getIdToken(true);
      } catch {
        // ignore
      }
      setRefreshingPerms(false);
    }
  }

  const canCreateUser = useMemo(() => {
    const em = newUserEmail.trim().toLowerCase();
    if (!canManageUsers) return false;
    if (!em.includes("@")) return false;
    if (!newUserTenantId) return false;
    return true;
  }, [canManageUsers, newUserEmail, newUserTenantId]);

  const canAssignNewUserRole = useMemo(
    () => canManageAdminSystemRole(authzSnapshot, normalizeRoleClient(newUserRole, newUserGovernorate)),
    [authzSnapshot, newUserRole, newUserGovernorate]
  );

  const createTenant = async () => {
    if (!user || !canSaveTenant) return;
    try {
      await createTenantAction({
        user,
        tenantId: newTenantId,
        tenantName: newTenantName,
        enabled: newTenantEnabled,
      });
      setNewTenantName("");
      setNewTenantIdRaw("");
      setNewTenantEnabled(true);
      setSelectedTenantId(newTenantId);
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر إنشاء المدرسة"));
    }
  };

  const saveTenantConfig = async () => {
    if (!user || !selectedTenantId) return;
    try {
      await saveTenantConfigAction({
        user,
        tenantId: selectedTenantId,
        config: selectedTenantConfig,
      });
      alert("تم حفظ إعدادات المدرسة.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ إعدادات المدرسة."));
    }
  };

  const toggleTenantEnabled = async (tenantId: string, enabled: boolean) => {
    if (!user) return;
    try {
      await toggleTenantEnabledAction({ user, tenantId, enabled });
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر تحديث حالة المدرسة."));
    }
  };

  const deleteTenant = async (tenantId: string) => {
    if (!user) return;
    if (tenantId === "system") {
      alert("لا يمكن حذف Tenant النظام.");
      return;
    }
    const ok = window.confirm(`هل أنت متأكد أنك تريد حذف المدرسة (Tenant): ${tenantId}؟

سيتم حذف بيانات المدرسة بالكامل.`);
    if (!ok) return;
    const alsoDeleteUsers = window.confirm(`هل تريد أيضاً حذف المستخدمين المرتبطين بهذه المدرسة من allowlist؟
(ينصح بنعم حتى لا يبقى مستخدمون مع Tenant غير موجود)`);
    try {
      setSupportError("");
      await deleteTenantAction({ user, tenantId, alsoDeleteUsers });
      setSelectedTenantId((prev) => (prev === tenantId ? "" : prev));
      alert("تم حذف المدرسة بنجاح.");
    } catch (e: any) {
      console.error(e);
      setSupportError(getActionErrorMessage(e, "تعذر حذف المدرسة"));
      alert("تعذر حذف المدرسة. تأكد من صلاحياتك ثم جرّب مرة أخرى.");
    }
  };

  const createAllowUser = async () => {
    if (!user) return;
    if (!canCreateUser || !canAssignNewUserRole) return;
    try {
      await createAllowUserAction({
        user,
        authzSnapshot,
        isSuper,
        profile,
        users,
        newUserEmail,
        newUserTenantId,
        newUserRole,
        newUserGovernorate,
        newUserEnabled,
        newUserName,
        newUserSchoolName,
        selectedTenantConfig,
      });
      setNewUserEmail("");
      setNewUserName("");
      setNewUserSchoolName("");
      setNewUserRole("user");
      setNewUserEnabled(true);
      setNewUserGovernorate("");
      await refreshMyPermissions();
      alert("تم إنشاء/تحديث المستخدم بنجاح.");
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حفظ المستخدم."));
    }
  };

  const updateUser = async (email: string, patch: Partial<AllowUser>, forceTransfer = false) => {
    if (!user) return;

    const current = users.find((u: any) => String(u.email || "").toLowerCase() === String(email || "").toLowerCase());
    const targetTenantId = String((patch as any)?.tenantId || (current as any)?.tenantId || "").trim();
    const targetTenant = visibleTenants.find((t: any) => String(t.id || "").trim() === targetTenantId);
    const currentTenantId = String((current as any)?.tenantId || "").trim();
    const currentTenant = visibleTenants.find((t: any) => String(t.id || "").trim() === currentTenantId);
    const currentSchoolName =
      String((current as any)?.schoolName || (current as any)?.tenantName || currentTenant?.name || currentTenantId || "").trim();
    const targetSchoolName =
      String((patch as any)?.schoolName || targetTenant?.name || targetTenantId || "").trim();

    try {
      await updateAllowUserAction({
        user,
        users,
        authzSnapshot,
        isSuper,
        resolveTenantGovernorate,
        email,
        patch,
        forceTransfer,
      });
    } catch (e: any) {
      const code = String(e?.message || "").trim();

      if (code === "EMAIL_ALREADY_LINKED_TO_ANOTHER_TENANT" && !forceTransfer) {
        const ok = window.confirm(
          `هذا البريد مرتبط حاليًا بالمدرسة: "${currentSchoolName}".\n\nهل تريد نقل الربط إلى المدرسة الجديدة: "${targetSchoolName}"؟`
        );
        if (!ok) return;
        await updateUser(email, patch, true);
        return;
      }

      if (code === "TENANT_ALREADY_LINKED_TO_ANOTHER_EMAIL") {
        alert("هذه المدرسة مرتبطة حاليًا ببريد آخر. يجب فك الربط الحالي أولًا أو اختيار مدرسة أخرى.");
        return;
      }

      alert(getActionErrorMessage(e, "تعذر تعديل المستخدم."));
    }
  };

  const removeUser = async (email: string) => {
    if (!user) return;
    const ok = window.confirm(`هل تريد حذف المستخدم: ${email} ؟`);
    if (!ok) return;
    try {
      await removeAllowUserAction({ user, users, authzSnapshot, email });
      await refreshMyPermissions();
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر حذف المستخدم."));
    }
  };

  const loadOwnerForTenant = async (tid: string) => {
    const id = String(tid || "").trim();
    if (!id) return;
    setOwnerDocLoading(true);
    try {
      setOwnerDoc(await loadOwnerForTenantAction(id));
    } finally {
      setOwnerDocLoading(false);
    }
  };

  const inviteSingleOwner = async () => {
    if (!user) return;
    try {
      await inviteSingleOwnerAction({ user, ownerTenantId, ownerEmail });
      alert("تمت إضافة المالك للقائمة المسموح بها. اطلب منه تسجيل الدخول مرة واحدة ليتم إنشاء meta/owner تلقائياً.");
      await loadOwnerForTenant(ownerTenantId);
    } catch (e: any) {
      alert(getActionErrorMessage(e, "تعذر دعوة المالك."));
    }
  };

  return (
    <div
      className="system-shell"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 520px at 50% 0%, rgba(16,185,129,0.08), transparent 55%), radial-gradient(900px 420px at 12% 18%, rgba(212,175,55,0.10), transparent 48%), radial-gradient(900px 420px at 88% 18%, rgba(59,130,246,0.06), transparent 45%), linear-gradient(180deg, #02060a 0%, #010307 100%)",
      }}
    >
      <style>{`
        @keyframes bellPulseGlow {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(212,175,55,0);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 18px rgba(212,175,55,0.55);
            opacity: 0.92;
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(212,175,55,0);
            opacity: 1;
          }
        }

        .new-suggestions-bell {
          animation: bellPulseGlow 1s infinite;
        }

        @keyframes adminHeaderPulse {
          0% { box-shadow: 0 0 0 rgba(212,175,55,0), 0 0 0 rgba(212,175,55,0); }
          50% { box-shadow: 0 0 34px rgba(212,175,55,0.16), 0 0 46px rgba(212,175,55,0.10); }
          100% { box-shadow: 0 0 0 rgba(212,175,55,0), 0 0 0 rgba(212,175,55,0); }
        }

        .admin-header-luxury {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          border: 4px solid rgba(212,175,55,0.95);
          background:
            linear-gradient(180deg, rgba(5,5,5,0.98) 0%, rgba(0,0,0,0.96) 100%);
          box-shadow:
            0 22px 58px rgba(0,0,0,0.52),
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 0 40px rgba(212,175,55,0.14);
          animation: adminHeaderPulse 4s ease-in-out infinite;
          margin: 10px 10px 0;
          padding: 10px;
        }

        .admin-header-luxury::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 14% 18%, rgba(212,175,55,0.12), transparent 22%),
            radial-gradient(circle at 86% 16%, rgba(212,175,55,0.10), transparent 18%),
            linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.07) 50%, transparent 100%);
          pointer-events: none;
        }

        .admin-panel-luxury {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(212,175,55,0.22);
          background:
            linear-gradient(180deg, rgba(2,6,12,0.92), rgba(0,0,0,0.84)),
            repeating-linear-gradient(135deg, rgba(212,175,55,0.08) 0px, rgba(212,175,55,0.08) 1px, transparent 1px, transparent 24px);
          box-shadow:
            0 24px 62px rgba(0,0,0,0.48),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 0 46px rgba(212,175,55,0.06);
        }

        .admin-title-premium {
          color: #f4d06f;
          text-shadow:
            0 4px 18px rgba(0,0,0,0.42),
            0 0 18px rgba(212,175,55,0.14);
          letter-spacing: 0.4px;
        }

        .admin-brand-premium {
          color: #f4d06f;
          text-shadow: 0 4px 15px rgba(0,0,0,0.36);
        }

        .admin-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(212,175,55,0.10);
          border: 1px solid rgba(212,175,55,0.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(8px);
        }

        .btn-luxury-green {
          background: linear-gradient(135deg, rgba(16,185,129,0.32), rgba(5,150,105,0.22)) !important;
          border: 1px solid rgba(16,185,129,0.38) !important;
          color: #ecfdf5 !important;
          box-shadow: 0 10px 24px rgba(16,185,129,0.12);
        }

        .btn-luxury-gold {
          background: linear-gradient(135deg, rgba(212,175,55,0.30), rgba(161,98,7,0.22)) !important;
          border: 1px solid rgba(212,175,55,0.42) !important;
          color: #fff7d1 !important;
          box-shadow: 0 10px 24px rgba(212,175,55,0.14);
        }

        .btn-luxury-blue {
          background: linear-gradient(135deg, rgba(59,130,246,0.30), rgba(29,78,216,0.22)) !important;
          border: 1px solid rgba(96,165,250,0.38) !important;
          color: #eff6ff !important;
          box-shadow: 0 10px 24px rgba(59,130,246,0.14);
        }

        .btn-luxury-purple {
          background: linear-gradient(135deg, rgba(168,85,247,0.30), rgba(126,34,206,0.22)) !important;
          border: 1px solid rgba(192,132,252,0.38) !important;
          color: #faf5ff !important;
          box-shadow: 0 10px 24px rgba(168,85,247,0.14);
        }

        .btn-luxury-red {
          background: linear-gradient(135deg, rgba(239,68,68,0.28), rgba(153,27,27,0.20)) !important;
          border: 1px solid rgba(248,113,113,0.38) !important;
          color: #fff1f2 !important;
          box-shadow: 0 10px 24px rgba(239,68,68,0.12);
        }

        .admin-hero-card {
          border-radius: 24px;
          border: 1px solid rgba(212,175,55,0.18);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
            radial-gradient(circle at top left, rgba(16,185,129,0.08), transparent 35%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          padding: 6px;
        }

      `}</style>

      <header className="system-header admin-header-luxury">
        <div className="system-header-inner">
          <div className="system-brand">
            <img src={MINISTRY_LOGO_URL} alt="logo" style={{ width: 108, height: 108, objectFit: "contain", filter: "drop-shadow(0 10px 22px rgba(212,175,55,0.34))" }} />
            <div className="system-brand-title admin-brand-premium" style={{ fontSize: 30, fontWeight: 900 }}>وزارة التعليم</div>
          </div>

          <div className="system-program admin-title-premium" style={{ fontSize: 54, fontWeight: 1000, lineHeight: 1.08 }}>نظام إدارة الامتحانات المطور</div>

          <div className="system-actions">
            <span className="admin-chip" style={{ opacity: 1, color: "#f4d06f", fontWeight: 900 }}>{roleLabel}</span>
            {user?.email ? <span className="admin-chip" style={{ opacity: 0.95, color: "#f8fafc" }}>({String(user.email)})</span> : null}

            <Button
              variant="ghost"
              onClick={() => navigate("/super/suggestions")}
              className={`btn-luxury-gold ${hasNewSuggestions ? "new-suggestions-bell" : ""}`}
              style={{
                padding: "8px 10px",
                position: "relative",
                border: hasNewSuggestions ? "1px solid rgba(212,175,55,0.45)" : undefined,
                background: hasNewSuggestions ? "rgba(212,175,55,0.12)" : undefined,
              }}
              title={hasNewSuggestions ? "يوجد رسائل تطوير جديدة" : "رسائل التطوير"}
            >
              {hasNewSuggestions ? "🔔 رسائل جديدة" : "🔔 رسائل التطوير"}
            </Button>

            <Button variant="ghost" className="btn-luxury-blue" onClick={() => navigate("/system/supers")} style={{ padding: "8px 10px" }}>
              إدارة سوبر المحافظات
            </Button>

            <Button variant="ghost" className="btn-luxury-purple" onClick={() => navigate("/system/add-supers")} style={{ padding: "8px 10px" }}>
              إضافة السوبرات
            </Button>

            <Button variant="ghost" className="btn-luxury-green" onClick={() => navigate("/super-system")} style={{ padding: "8px 10px" }}>
              صفحة السوبر (المحافظات)
            </Button>

            <Button variant="ghost" className="btn-luxury-gold" onClick={() => navigate("/super")} style={{ padding: "8px 10px" }}>
              العودة إلى صفحة Super
            </Button>

            <Button variant="ghost" className="btn-luxury-red" onClick={logout} style={{ padding: "8px 10px" }}>
              تسجيل خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="system-main">
        <div
          className="system-glow admin-panel-luxury"
          style={{
            borderRadius: 28,
            padding: 20,
            border: `1px solid ${LINE}`,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            <div className="admin-hero-card">
            <Card
              title="لوحة مالك المنصة - إدارة المدارس والمستخدمين"
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ opacity: 0.85 }}>
                    {isPlatformOwner ? "صلاحيات المالك الكاملة مفعلة" : roleLabel}
                  </div>
                  <Button variant="ghost" onClick={refreshMyPermissions} disabled={refreshingPerms}>
                    {refreshingPerms ? "..." : "تحديث الصلاحيات"}
                  </Button>
                </div>
              }
            >
              <div style={{ color: "#e5e7eb", lineHeight: 2.0, fontSize: 16 }}>
                {isPlatformOwner ? (
                  <>
                    أنت الآن داخل <b style={{ color: GOLD }}>لوحة مالك المنصة</b>، لذلك يمكنك إدارة جميع المدارس وجميع المستخدمين والصلاحيات العليا عبر النظام بالكامل ضمن واجهة أكثر أناقة ووضوحًا.
                    <br />
                  </>
                ) : null}
                هنا تستطيع إنشاء مدارس جديدة (Tenants)، وربط المستخدمين بها بشكل صحيح، ومتابعة الصلاحيات العليا بثقة وتنظيم.
                <br />
                <b style={{ color: GOLD }}>مهم:</b> tenantId يجب أن يكون إنجليزي صغير + أرقام + "-" فقط.
              </div>
            </Card>
            </div>

            <AdminTenantsSection
              visibleTenants={visibleTenants}
              selectedTenantId={selectedTenantId}
              setSelectedTenantId={setSelectedTenantId}
              supportError={supportError}
              canSupport={canSupport}
              startSupportForTenant={startSupportForTenant}
              navigate={navigate}
              setSupportError={setSupportError}
              deleteTenant={deleteTenant}
              selectedTenantConfig={selectedTenantConfig}
              setSelectedTenantConfig={setSelectedTenantConfig}
              loadingConfig={loadingConfig}
              saveTenantConfig={saveTenantConfig}
              newTenantName={newTenantName}
              setNewTenantName={setNewTenantName}
              newTenantIdRaw={newTenantIdRaw}
              setNewTenantIdRaw={setNewTenantIdRaw}
              newTenantId={newTenantId}
              isValidTenantId={isValidTenantId}
              newTenantEnabled={newTenantEnabled}
              setNewTenantEnabled={setNewTenantEnabled}
              createTenant={createTenant}
              canSaveTenant={canSaveTenant}
              toggleTenantEnabled={toggleTenantEnabled}
            />

            <AdminUsersSection
              authzSnapshot={authzSnapshot}
              visibleTenants={visibleTenants}
              newUserEmail={newUserEmail}
              setNewUserEmail={setNewUserEmail}
              newUserName={newUserName}
              setNewUserName={setNewUserName}
              newUserSchoolName={newUserSchoolName}
              setNewUserSchoolName={setNewUserSchoolName}
              newUserTenantId={newUserTenantId}
              setNewUserTenantId={setNewUserTenantId}
              newUserRole={newUserRole}
              setNewUserRole={setNewUserRole}
              newUserGovernorate={newUserGovernorate}
              setNewUserGovernorate={setNewUserGovernorate}
              newUserEnabled={newUserEnabled}
              setNewUserEnabled={setNewUserEnabled}
              createAllowUser={createAllowUser}
              canCreateUser={canCreateUser}
              canAssignNewUserRole={canAssignNewUserRole}
              search={search}
              setSearch={setSearch}
              filteredUsers={filteredUsers}
              editDrafts={editDrafts}
              setDraft={setDraft}
              updateUser={updateUser}
              clearDraft={clearDraft}
              removeUser={removeUser}
            />

            <AdminOwnerToolsSection
              ownerTenantId={ownerTenantId}
              setOwnerTenantId={setOwnerTenantId}
              ownerEmail={ownerEmail}
              setOwnerEmail={setOwnerEmail}
              inviteSingleOwner={inviteSingleOwner}
              loadOwnerForTenant={loadOwnerForTenant}
              ownerDocLoading={ownerDocLoading}
              ownerDoc={ownerDoc}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
