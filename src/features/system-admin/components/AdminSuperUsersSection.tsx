import React from "react";
import { DIRECTORATES, MINISTRY_SCOPE } from "../../../constants/directorates";
import { Button, Card, GOLD, Input } from "../ui";
import { useI18n } from "../../../i18n/I18nProvider";

export default function AdminSuperUsersSection(props: any) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const {
    superEmail,
    setSuperEmail,
    superName,
    setSuperName,
    superRole,
    setSuperRole,
    superGovernorate,
    setSuperGovernorate,
    superEnabled,
    setSuperEnabled,
    createSuperUser,
    canCreateSuperUser,
    supers,
    removeSuperUser,
  } = props;

  const isMinistrySuper = String(superRole || "") === "ministry_super";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 440px) 1fr", gap: 14, alignItems: "start" }}>
      <Card title={tr("إضافة سوبر المحافظات / سوبر الوزارة", "Add Governorates Super / Ministry Super")}>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>
              {tr("البريد الإلكتروني (مفتاح الوثيقة)", "Email (document key)")}
            </div>
            <Input
              value={superEmail}
              onChange={(e) => setSuperEmail(e.target.value)}
              placeholder="super@example.com"
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>
              {tr("الاسم", "Name")}
            </div>
            <Input
              value={superName}
              onChange={(e) => setSuperName(e.target.value)}
              placeholder={tr("اسم المستخدم", "User name")}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>
              {tr("نوع الصلاحية", "Role type")}
            </div>
            <select
              value={superRole}
              onChange={(e) => setSuperRole(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(2,6,23,0.55)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#e5e7eb",
              }}
            >
              <option value="super">{tr("سوبر المحافظات", "Governorates Super")}</option>
              <option value="ministry_super">{tr("سوبر الوزارة", "Ministry Super")}</option>
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.85 }}>
              {tr("المحافظة / النطاق", "Governorate / Scope")}
            </div>
            <select
              value={superGovernorate}
              onChange={(e) => setSuperGovernorate(e.target.value)}
              disabled={isMinistrySuper}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(2,6,23,0.55)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#e5e7eb",
                opacity: isMinistrySuper ? 0.7 : 1,
              }}
            >
              <option value="">{tr("اختر المحافظة", "Choose governorate")}</option>
              <option value={MINISTRY_SCOPE}>{tr("سوبر الوزارة", "Ministry Super")}</option>
              {DIRECTORATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              {isMinistrySuper
                ? tr("عند اختيار سوبر الوزارة يتم تثبيت النطاق تلقائيًا على الوزارة.", "When Ministry Super is selected, the scope is automatically fixed to the ministry.")
                : tr("سوبر المحافظات يجب أن يكون مرتبطًا بمحافظة واحدة فقط.", "Governorates Super must be linked to one governorate only.")}
            </div>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!superEnabled}
              onChange={(e) => setSuperEnabled(e.target.checked)}
            />
            <span>{tr("مُفعّل", "Enabled")}</span>
          </label>

          <Button onClick={createSuperUser} disabled={!canCreateSuperUser}>
            {tr("حفظ السوبر", "Save super user")}
          </Button>

          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.8 }}>
            <b style={{ color: GOLD }}>{tr("قواعد هذه الصفحة:", "Rules for this section:")}</b>
            <br />
            {tr("1) هذه الصفحة لمالك المنصة فقط.", "1) This section is for the platform owner only.")}
            <br />
            {tr("2) سوبر الوزارة للمشاهدة فقط ولا يدخل إلى بيانات المدارس الداخلية.", "2) Ministry Super is read-only and does not enter internal school data.")}
            <br />
            {tr("3) سوبر المحافظات يدير المدارس وأدمنات المدارس داخل محافظته فقط.", "3) Governorates Super manages schools and school admins inside their governorate only.")}
          </div>
        </div>
      </Card>

      <Card title={tr("قائمة السوبرات", "Super users list")}>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
            <thead>
              <tr style={{ textAlign: "right", opacity: 0.9 }}>
                <th style={{ padding: "0 10px" }}>Email</th>
                <th style={{ padding: "0 10px" }}>{tr("الاسم", "Name")}</th>
                <th style={{ padding: "0 10px" }}>{tr("الدور", "Role")}</th>
                <th style={{ padding: "0 10px" }}>{tr("المحافظة", "Governorate")}</th>
                <th style={{ padding: "0 10px" }}>{tr("الحالة", "Status")}</th>
                <th style={{ padding: "0 10px" }}>{tr("إجراءات", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(supers || []).map((u: any) => {
                const role = String(u.role || "");
                const roleLabel =
                  role === "ministry_super"
                    ? tr("سوبر الوزارة", "Ministry Super")
                    : tr("سوبر المحافظات", "Governorates Super");

                return (
                  <tr
                    key={u.email}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <td style={{ padding: "12px 10px", borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}>
                      <div style={{ fontWeight: 900, color: "#e5e7eb" }}>{u.email}</div>
                    </td>
                    <td style={{ padding: "12px 10px" }}>{u.name || "-"}</td>
                    <td style={{ padding: "12px 10px" }}>{roleLabel}</td>
                    <td style={{ padding: "12px 10px" }}>
                      {role === "ministry_super" ? tr("الوزارة", "Ministry") : (u.governorate || "-")}
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      {u.enabled ? tr("مفعّل", "Enabled") : tr("غير مفعّل", "Disabled")}
                    </td>
                    <td style={{ padding: "12px 10px", borderTopRightRadius: 14, borderBottomRightRadius: 14 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button variant="danger" onClick={() => removeSuperUser?.(u.email)}>
                          {tr("حذف", "Delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!(supers || []).length ? (
            <div style={{ opacity: 0.85 }}>
              {tr("لا يوجد سوبرات بعد.", "No super users yet.")}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
