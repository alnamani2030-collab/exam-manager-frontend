import React from "react";
import { Button, Card, Input } from "../ui";
import { useI18n } from "../../../i18n/I18nProvider";

export default function AdminOwnerToolsSection(props: any) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { ownerTenantId, setOwnerTenantId, ownerEmail, setOwnerEmail, inviteSingleOwner, loadOwnerForTenant, ownerDocLoading, ownerDoc } = props;
  return (
    <Card title={tr("معالج مالك واحد لكل مدرسة (meta/owner)", "Single owner wizard for each school (meta/owner)")}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{tr("TenantId (المدرسة)", "TenantId (school)")}</div><Input value={ownerTenantId} onChange={(e) => setOwnerTenantId(e.target.value)} placeholder={tr("مثال: azaan-9-12", "Example: azaan-9-12")} /></div>
        <div><div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{tr("Owner Email (بريد المالك)", "Owner Email")}</div><Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@school.com" /></div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Button onClick={inviteSingleOwner}>{tr("دعوة المالك", "Invite owner")}</Button>
        <Button variant="ghost" onClick={() => loadOwnerForTenant(ownerTenantId)}>{tr("فحص meta/owner", "Check meta/owner")}</Button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{tr("سيتم إنشاء ", "It will create ")}<code>tenants/&lt;tenantId&gt;/meta/owner</code>{tr(" تلقائياً عند أول تسجيل دخول للمالك.", " automatically on the owner’s first sign-in.")}</div>
      </div>
      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(2,6,23,0.55)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontWeight: 800 }}>{tr("حالة المالك", "Owner status")}</div>{ownerDocLoading ? <span style={{ opacity: 0.85 }}>{tr("جاري التحميل…", "Loading…")}</span> : null}</div>
        {ownerDoc ? (
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.8 }}><div><b>email:</b> {ownerDoc.email}</div><div><b>uid:</b> {ownerDoc.uid}</div><div style={{ opacity: 0.85 }}>{tr("تمت الملكية بنجاح. أي محاولة لإنشاء owner جديد ستفشل تلقائياً (One Owner).", "Ownership is completed successfully. Any attempt to create a new owner will fail automatically (One Owner).")}</div></div>
        ) : <div style={{ marginTop: 10, opacity: 0.85 }}>{tr("لا يوجد owner بعد. بعد دعوة المالك، اطلب منه تسجيل الدخول مرة واحدة لإتمام إنشاء meta/owner.", "There is no owner yet. After inviting the owner, ask them to sign in once to complete creating meta/owner.")}</div>}
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={() => (window.location.href = "/activity-logs")}>{tr("سجلات النشاط", "Activity logs")}</Button>
          <Button variant="ghost" onClick={() => { const tid = String(ownerTenantId || "").trim(); if (!tid) return alert(tr("أدخل tenantId أولاً", "Enter tenantId first")); alert(tr("SecurityAudit يتم حفظه في Firestore: tenants/{tenantId}/securityAudit.", "SecurityAudit is saved in Firestore: tenants/{tenantId}/securityAudit.")); }}>SecurityAudit</Button>
        </div>
      </div>
    </Card>
  );
}
