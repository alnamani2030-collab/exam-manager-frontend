import React from "react";
import { DIRECTORATES, MINISTRY_SCOPE, PRIMARY_SUPER_ADMIN_EMAIL } from "../../../constants/directorates";
import { useI18n } from "../../../i18n/I18nProvider";
import { canManageAdminSystemRole } from "../../authz";
import { Button, Card, GOLD, Input } from "../ui";

export default function AdminUsersSection(props: any) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const {
    authzSnapshot,
    visibleTenants,
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
    createAllowUser,
    canCreateUser,
    canAssignNewUserRole,
    search,
    setSearch,
    filteredUsers,
    editDrafts,
    setDraft,
    updateUser,
    clearDraft,
    removeUser,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: 14, alignItems: "start" }}>
      <Card title={tr("إضافة/ربط مستخدم بالمدرسة", "Add/Link User to School")}>
        <div style={{ display: "grid", gap: 10 }}>
          <div><div style={{ marginBottom: 6, opacity: 0.85 }}>{tr("البريد الإلكتروني (مفتاح الوثيقة)", "Email (document key)")}</div><Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@school.com" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={{ marginBottom: 6, opacity: 0.85 }}>{tr("الاسم", "Name")}</div><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder={tr("اسم المستخدم", "User name")} /></div>
            <div><div style={{ marginBottom: 6, opacity: 0.85 }}>{tr("اسم المدرسة (اختياري)", "School name (optional)")}</div><Input value={newUserSchoolName} onChange={(e) => setNewUserSchoolName(e.target.value)} placeholder={tr("اسم المدرسة", "School name")} /></div>
          </div>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>{tr("اختر المدرسة (Tenant)", "Choose school (Tenant)")}</div>
            <select value={newUserTenantId} onChange={(e) => setNewUserTenantId(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb" }}>
              <option value="">{tr("-- اختر --", "-- Choose --")}</option>
              {visibleTenants.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.id} ({t.id})</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ marginBottom: 6, opacity: 0.85 }}>{tr("الدور", "Role")}</div>
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb" }}>
                <option value="admin">{tr("الأدمن (مدرسة)", "Admin (school)")}</option>
                {canManageAdminSystemRole(authzSnapshot, "super_admin") && <option value="super_admin">{tr("مالك المنصة (super_admin)", "Platform owner (super_admin)")}</option>}
                {canManageAdminSystemRole(authzSnapshot, "super") && <option value="super">{tr("مشرف نطاق (super)", "Domain supervisor (super)")}</option>}
              </select>
            </div>
            {String(newUserRole) === "super" && (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{tr("مديرية السوبر", "Super directorate")}</div>
                <select value={newUserGovernorate} onChange={(e) => setNewUserGovernorate(e.target.value)} style={{ width: 260, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,215,0,0.25)", background: "rgba(0,0,0,0.35)", color: "#FFD700", outline: "none" }}>
                  <option value="">{tr("اختر المديرية", "Choose directorate")}</option>
                  <option value={MINISTRY_SCOPE}>{tr("سوبر الوزارة", "Ministry super")}</option>
                  {DIRECTORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 26 }}><input type="checkbox" checked={newUserEnabled} onChange={(e) => setNewUserEnabled(e.target.checked)} /><span>{tr("مُفعّل", "Enabled")}</span></label>
          </div>
          <Button onClick={createAllowUser} disabled={!canCreateUser || !canAssignNewUserRole}>{tr("حفظ المستخدم", "Save user")}</Button>
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.7 }}><b style={{ color: GOLD }}>{tr("قاعدة ثابتة بدون أخطاء:", "Fixed rule without errors:")}</b><br />{tr("1) أنشئ Tenant أولاً (ID صحيح).", "1) Create the Tenant first (valid ID).")} <br />{tr("2) أنشئ/حدّث مستخدم في allowlist بنفس البريد.", "2) Create/update a user in allowlist with the same email.")} <br />{tr("3) ضع tenantId = Tenant ID بالإنجليزي.", "3) Set tenantId = Tenant ID in English.")} <br />{tr("4) فعّل enabled = true.", "4) Set enabled = true.")}</div>
        </div>
      </Card>

      <Card title={tr("قائمة المستخدمين (allowlist)", "Users list (allowlist)")} right={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث: email / tenant / role...", "Search: email / tenant / role...")} style={{ width: 320 }} />}>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
            <thead><tr style={{ textAlign: "right", opacity: 0.9 }}><th style={{ padding: "0 10px" }}>Email</th><th style={{ padding: "0 10px" }}>Tenant</th><th style={{ padding: "0 10px" }}>Role</th><th style={{ padding: "0 10px" }}>Enabled</th><th style={{ padding: "0 10px" }}>{tr("إجراءات", "Actions")}</th></tr></thead>
            <tbody>
              {filteredUsers.map((u: any) => {
                const key = String(u.email || "").toLowerCase().trim();
                const isPrimaryRow = key === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
                const draft = editDrafts[key] || {};
                const view = { ...u, ...draft } as any;
                if (isPrimaryRow) { view.role = "super_admin"; view.enabled = true; }
                const dirty = Object.keys(draft).length > 0;
                return (
                  <tr key={u.email} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    <td style={{ padding: "12px 10px", borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}><div style={{ fontWeight: 900, color: "#e5e7eb" }}>{u.email}</div><div style={{ fontSize: 12, opacity: 0.8 }}>{u.name || ""}</div></td>
                    <td style={{ padding: "12px 10px" }}><select value={view.tenantId || ""} disabled={isPrimaryRow} onChange={(e) => { if (isPrimaryRow) return; setDraft(u.email, { tenantId: e.target.value }); }} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", minWidth: 240 }}>{visibleTenants.map((t: any) => <option key={t.id} value={t.id}>{t.id}</option>)}</select></td>
                    <td style={{ padding: "12px 10px" }}><select value={view.role} disabled={isPrimaryRow} onChange={(e) => { if (isPrimaryRow) return; setDraft(u.email, { role: e.target.value }); }} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb" }}><option value="admin">admin</option>{canManageAdminSystemRole(authzSnapshot, "super") && <option value="super">super</option>}{canManageAdminSystemRole(authzSnapshot, "super_admin") && <option value="super_admin">{tr("super admin", "super admin")}</option>}</select></td>
                    <td style={{ padding: "12px 10px" }}><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={!!view.enabled} disabled={isPrimaryRow} onChange={(e) => { if (isPrimaryRow) return; setDraft(u.email, { enabled: e.target.checked }); }} /><span style={{ fontSize: 12, opacity: 0.9 }}>{view.enabled ? tr("نعم", "Yes") : tr("لا", "No")}</span></label></td>
                    <td style={{ padding: "12px 10px", borderTopRightRadius: 14, borderBottomRightRadius: 14 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="ghost" disabled={!dirty || isPrimaryRow} onClick={async () => { const patch = editDrafts[key] || {}; if (!Object.keys(patch).length) return; await updateUser(u.email, patch); clearDraft(u.email); }} title={dirty ? tr("تطبيق التعديل", "Apply changes") : tr("لا يوجد تعديل", "No changes")}>{tr("تعديل", "Edit")}</Button><Button variant="danger" disabled={isPrimaryRow} onClick={() => { if (isPrimaryRow) return; removeUser(u.email); }}>{tr("حذف", "Delete")}</Button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredUsers.length ? <div style={{ opacity: 0.85 }}>{tr("لا يوجد نتائج.", "No results.")}</div> : null}
        </div>
      </Card>
    </div>
  );
}
