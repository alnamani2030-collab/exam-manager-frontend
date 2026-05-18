// src/pages/AddSchoolAdminByGovernorate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  isPlatformOwner,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { MINISTRY_SCOPE } from "../constants/directorates";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getGovernorateValue(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.scopeGovernorate ??
          item?.gov ??
          "";
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return "";
}

function sameGovernorate(a: unknown, b: unknown) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function safeDocIdFromEmail(email: string) {
  return normalizeEmail(email);
}

function makeTenantIdFromName(name: string) {
  const cleaned = normalizeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return cleaned || `school-${Date.now()}`;
}

function tenantNameOf(tenant: any) {
  return normalizeText(tenant?.name || tenant?.tenantName || tenant?.schoolName || tenant?.title || tenant?.id);
}

function isExamCenterTenant(tenant: any) {
  const values = [tenant?.tenantType, tenant?.type, tenant?.entityType, tenant?.kind, tenant?.category]
    .map((v) => normalizeText(v).toLowerCase())
    .filter(Boolean);

  return (
    tenant?.isExamCenter === true ||
    tenant?.isDiplomaCenter === true ||
    values.some((v) => ["exam_center", "exam-center", "examcenter", "diploma_center", "diploma-center"].includes(v))
  );
}

type TenantRow = {
  id: string;
  name: string;
  governorate: string;
  active?: boolean;
};

type SchoolAdminRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  governorate: string;
  enabled: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1.5px solid #d5b95f",
  borderRadius: 14,
  padding: "13px 14px",
  background: "#fffdf7",
  color: "#000",
  WebkitTextFillColor: "#000",
  fontWeight: 800,
  fontSize: 15,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#111827",
  fontWeight: 900,
};

const buttonStyle: React.CSSProperties = {
  border: "1.5px solid #b58b16",
  background: "linear-gradient(180deg, #f6df83, #d7b83e)",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#000",
  fontWeight: 950,
  cursor: "pointer",
};

function Field(props: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <input
        type={props.type || "text"}
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ ...inputStyle, opacity: props.disabled ? 0.75 : 1 }}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ ...inputStyle, color: "#000", WebkitTextFillColor: "#000", cursor: props.disabled ? "not-allowed" : "pointer" }}
      >
        {props.children}
      </select>
    </label>
  );
}

export default function AddSchoolAdminByGovernorate() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, allow } = auth;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const roleBadge = resolveRoleBadgeStyle(authzSnapshot);
  const isOwner = isPlatformOwner(authzSnapshot);
  const canManageSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");

  if (!user) return <Navigate to="/login" replace />;
  if (!allow?.enabled) return <Navigate to="/login" replace />;
  if (!canManageSystem) return <Navigate to="/" replace />;

  const myGov = getGovernorateValue(allow, authzSnapshot as any);
  const isMinistryViewer = !isOwner && myGov === MINISTRY_SCOPE;
  const canSeeAllGovs = isOwner || isMinistryViewer;
  const canWrite = isOwner || (!isMinistryViewer && !!myGov);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [admins, setAdmins] = useState<SchoolAdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [editingEmail, setEditingEmail] = useState("");
  const [schoolMode, setSchoolMode] = useState<"existing" | "new">("existing");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolTenantId, setNewSchoolTenantId] = useState("");
  const [newSchoolGovernorate, setNewSchoolGovernorate] = useState(myGov || "");

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) || null,
    [tenants, selectedTenantId],
  );

  const buildTenantRowFromDoc = (item: any): (TenantRow & { raw: any }) => {
    const data = item.data() as any;
    return {
      id: item.id,
      name: tenantNameOf({ id: item.id, ...data }),
      governorate: getGovernorateValue(data),
      active: data?.enabled !== false && data?.active !== false,
      raw: data,
    };
  };

  const mergeTenantRows = (rows: Array<TenantRow & { raw: any }>) => {
    const map = new Map<string, TenantRow & { raw: any }>();
    for (const row of rows) {
      if (!row?.id) continue;
      if (isExamCenterTenant(row.raw)) continue;
      if (!canSeeAllGovs && !sameGovernorate(row.governorate, myGov)) continue;
      if (!map.has(row.id)) map.set(row.id, row);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  };

  const loadTenants = async () => {
    setError("");
    setLoading(true);
    try {
      let rows: Array<TenantRow & { raw: any }> = [];

      if (canSeeAllGovs) {
        const snap = await getDocs(collection(db, "tenants"));
        rows = snap.docs.map(buildTenantRowFromDoc);
      } else {
        const gov = normalizeText(myGov);
        if (!gov) {
          setTenants([]);
          setSelectedTenantId("");
          setError("لا توجد محافظة واضحة للمستخدم الحالي، لذلك لا يمكن تحميل المدارس.");
          return;
        }

        // مهم بعد تقوية firestore.rules:
        // مشرف المحافظة لا يطلب كل المدارس، بل يستعلم عن مدارس محافظته فقط.
        // نبحث في أكثر من حقل لأن بعض السجلات القديمة تحفظ المحافظة بأسماء مختلفة.
        const governorateFields = ["governorate", "tenantGovernorate", "regionAr", "governorateAr", "scopeGovernorate", "gov"];
        const byId = new Map<string, TenantRow & { raw: any }>();
        const errors: string[] = [];

        for (const field of governorateFields) {
          try {
            const snap = await getDocs(query(collection(db, "tenants"), where(field, "==", gov)));
            for (const item of snap.docs) {
              const row = buildTenantRowFromDoc(item);
              if (!byId.has(row.id)) byId.set(row.id, row);
            }
          } catch (err: any) {
            errors.push(err?.message || field);
          }
        }

        rows = Array.from(byId.values());

        if (!rows.length && errors.length) {
          throw new Error(errors[0] || "Missing or insufficient permissions");
        }
      }

      const normalizedRows = mergeTenantRows(rows);
      setTenants(normalizedRows);
      if (!normalizedRows.some((tenant) => tenant.id === selectedTenantId)) {
        setSelectedTenantId(normalizedRows[0]?.id || "");
      }
    } catch (err: any) {
      setTenants([]);
      setSelectedTenantId("");
      setError(err?.message || "تعذر تحميل المدارس. تأكد من الصلاحيات أو الاتصال بالسحابة.");
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    setError("");
    try {
      const allowRef = collection(db, "allowlist");
      const snap = canSeeAllGovs
        ? await getDocs(query(allowRef, where("role", "in", ["tenant_admin", "admin"])))
        : await getDocs(
            query(
              allowRef,
              where("role", "in", ["tenant_admin", "admin"]),
              where("governorate", "==", myGov),
            ),
          );

      const rows = snap.docs
        .map((item) => {
          const data = item.data() as any;
          return {
            id: item.id,
            email: normalizeEmail(data.email || item.id),
            name: normalizeText(data.userName || data.name || data.displayName),
            tenantId: normalizeText(data.tenantId),
            tenantName: normalizeText(data.tenantName || data.schoolName || data.name || data.tenantId),
            governorate: getGovernorateValue(data),
            enabled: data.enabled !== false,
          };
        })
        .filter((row) => row.tenantId)
        .filter((row) => (canSeeAllGovs ? true : sameGovernorate(row.governorate, myGov)))
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName, "ar"));

      setAdmins(rows);
    } catch (err: any) {
      setError(err?.message || "تعذر تحميل أدمنات المدارس. يمكنك الإضافة رغم ذلك إذا كانت الصلاحيات تسمح.");
    }
  };

  useEffect(() => {
    void loadTenants();
    void loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGov, isOwner]);

  useEffect(() => {
    if (!isOwner && myGov) setNewSchoolGovernorate(myGov);
  }, [isOwner, myGov]);

  const resetForm = () => {
    setAdminEmail("");
    setAdminName("");
    setEnabled(true);
    setEditingEmail("");
    setNewSchoolName("");
    setNewSchoolTenantId("");
    if (!isOwner && myGov) setNewSchoolGovernorate(myGov);
    setMessage("");
    setError("");
  };

  const startEdit = (row: SchoolAdminRow) => {
    setSchoolMode("existing");
    setEditingEmail(row.email);
    setAdminEmail(row.email);
    setAdminName(row.name);
    setSelectedTenantId(row.tenantId);
    setEnabled(row.enabled);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAdmin = async () => {
    setMessage("");
    setError("");

    const email = normalizeEmail(adminEmail);
    const name = normalizeText(adminName);
    const isCreatingNewSchool = schoolMode === "new";
    const existingTenant = selectedTenant;
    const typedSchoolName = normalizeText(newSchoolName);
    const typedTenantId = normalizeText(newSchoolTenantId);

    if (!canWrite) {
      setError("هذه الصفحة مشاهدة فقط ولا تملك صلاحية إضافة أدمن مدرسة.");
      return;
    }
    if (!email.includes("@")) {
      setError("اكتب بريدًا إلكترونيًا صحيحًا لأدمن المدرسة.");
      return;
    }
    if (!name) {
      setError("اكتب اسم أدمن المدرسة.");
      return;
    }

    if (!isCreatingNewSchool && !existingTenant?.id) {
      setError("اختر المدرسة التي سيتم ربط الأدمن بها.");
      return;
    }

    if (isCreatingNewSchool && !typedSchoolName) {
      setError("اكتب اسم المدرسة الجديدة.");
      return;
    }

    const effectiveGovernorate = isCreatingNewSchool
      ? normalizeText(isOwner ? newSchoolGovernorate || myGov : myGov)
      : isOwner
        ? getGovernorateValue(existingTenant)
        : myGov;

    if (!effectiveGovernorate) {
      setError("لا توجد محافظة واضحة للمدرسة أو للمستخدم الحالي.");
      return;
    }
    if (!isOwner && !sameGovernorate(effectiveGovernorate, myGov)) {
      setError("لا يمكن ربط أدمن بمدرسة خارج نطاق محافظتك.");
      return;
    }

    const targetTenantId = isCreatingNewSchool
      ? typedTenantId || makeTenantIdFromName(typedSchoolName)
      : existingTenant?.id || "";
    const targetTenantName = isCreatingNewSchool
      ? typedSchoolName
      : existingTenant?.name || targetTenantId;

    if (!targetTenantId) {
      setError("تعذر تحديد معرف المدرسة.");
      return;
    }

    setSaving(true);
    try {
      if (isCreatingNewSchool) {
        const tenantPayload = {
          name: targetTenantName,
          tenantName: targetTenantName,
          schoolName: targetTenantName,
          title: targetTenantName,
          tenantId: targetTenantId,
          tenantType: "school",
          type: "school",
          entityType: "school",
          kind: "school",
          category: "school",
          isExamCenter: false,
          isDiplomaCenter: false,
          enabled: true,
          active: true,
          governorate: effectiveGovernorate,
          tenantGovernorate: effectiveGovernorate,
          regionAr: effectiveGovernorate,
          governorateAr: effectiveGovernorate,
          scopeGovernorate: effectiveGovernorate,
          createdBy: normalizeEmail(user?.email),
          createdByRole: isOwner ? "platform_owner" : "governorate_super",
          updatedBy: normalizeEmail(user?.email),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any;

        await setDoc(doc(db, "tenants", targetTenantId), tenantPayload, { merge: true });
        await setDoc(
          doc(db, "tenants", targetTenantId, "meta", "config"),
          {
            ...tenantPayload,
            configType: "school",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      const payload = {
        email,
        role: "tenant_admin",
        enabled,
        tenantId: targetTenantId,
        tenantName: targetTenantName,
        schoolName: targetTenantName,
        userName: name,
        name,
        governorate: effectiveGovernorate,
        tenantGovernorate: effectiveGovernorate,
        regionAr: effectiveGovernorate,
        governorateAr: effectiveGovernorate,
        scopeGovernorate: effectiveGovernorate,
        scopeType: "tenant",
        createdByRole: isOwner ? "platform_owner" : "governorate_super",
        updatedBy: normalizeEmail(user?.email),
        updatedAt: serverTimestamp(),
      } as any;

      if (!editingEmail) payload.createdAt = serverTimestamp();

      await setDoc(doc(db, "allowlist", safeDocIdFromEmail(email)), payload, { merge: true });

      // مسار مساعد فقط. إذا لم تسمح قواعد Firestore به، لا نكسر حفظ allowlist.
      try {
        await setDoc(
          doc(db, "tenantAdminLinks", targetTenantId),
          {
            tenantId: targetTenantId,
            tenantName: targetTenantName,
            schoolName: targetTenantName,
            email,
            userName: name,
            governorate: effectiveGovernorate,
            tenantGovernorate: effectiveGovernorate,
            enabled,
            updatedBy: normalizeEmail(user?.email),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        // لا نوقف الربط الأساسي إذا كان هذا المسار غير مسموح.
      }

      setMessage(
        editingEmail
          ? "تم تحديث أدمن المدرسة بنجاح."
          : isCreatingNewSchool
            ? "تم إنشاء المدرسة وربط أدمن المدرسة بها بنجاح."
            : "تم إضافة وربط أدمن المدرسة بنجاح.",
      );
      resetForm();
      await loadTenants();
      await loadAdmins();
    } catch (err: any) {
      setError(err?.message || "تعذر حفظ أدمن المدرسة. راجع قواعد Firestore والصلاحيات.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmin = async (row: SchoolAdminRow) => {
    if (!canWrite) return;
    if (!window.confirm(`هل تريد حذف ربط أدمن المدرسة؟\n${row.email}`)) return;
    if (!window.confirm("تأكيد نهائي: سيتم حذف سجل الأدمن من allowlist إذا كانت الصلاحيات تسمح.")) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deleteDoc(doc(db, "allowlist", safeDocIdFromEmail(row.email)));
      try {
        if (row.tenantId) await deleteDoc(doc(db, "tenantAdminLinks", row.tenantId));
      } catch {
        // لا نوقف الحذف الأساسي.
      }
      setMessage("تم حذف أدمن المدرسة بنجاح.");
      await loadAdmins();
    } catch (err: any) {
      setError(err?.message || "تعذر حذف أدمن المدرسة بسبب الصلاحيات.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f7f3e7, #efe4c7)", padding: 24, color: "#000" }}>
      <style>{`
        input, select, textarea, option { color: #000 !important; -webkit-text-fill-color: #000 !important; }
        input::placeholder { color: #6b7280 !important; -webkit-text-fill-color: #6b7280 !important; }
        select { background-color: #fffdf7 !important; }
        option { background-color: #ffffff !important; }
      `}</style>
      <section
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          border: "2px solid #caa537",
          borderRadius: 26,
          background: "rgba(255,253,246,0.96)",
          boxShadow: "0 22px 60px rgba(80,60,10,0.12)",
          padding: 24,
        }}
      >
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 20,
            alignItems: "center",
            border: "1.5px solid #d4af37",
            borderRadius: 22,
            padding: "18px 22px",
            marginBottom: 22,
            background: "linear-gradient(135deg, #fff8dd, #fffdf7)",
          }}
        >
          <img src={MINISTRY_LOGO_URL} alt="شعار" style={{ width: 86, height: 86, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 950, fontSize: 30 }}>إضافة أدمن مدرسة</div>
            <div style={{ fontWeight: 800, marginTop: 8 }}>ربط أدمن بمدرسة داخل نطاق المحافظة دون تعديل بيانات المدرسة.</div>
            <div style={{ marginTop: 10, color: "#4b5563", fontWeight: 800 }}>{roleBadge.label} — {myGov || "كل المحافظات"}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
            <button style={buttonStyle} onClick={() => navigate(isOwner ? "/platform-super-system" : "/super-system")}>العودة للبوابة الإشرافية</button>
            <button style={{ ...buttonStyle, background: "#fff" }} onClick={() => { void loadTenants(); void loadAdmins(); }}>تحديث</button>
          </div>
        </header>

        {message ? <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "#ecfdf3", border: "1px solid #86efac", color: "#14532d", fontWeight: 900 }}>{message}</div> : null}
        {error ? <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "#fff1f2", border: "1px solid #fecdd3", color: "#7f1d1d", fontWeight: 900 }}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 520px) 1fr", gap: 22, alignItems: "start" }}>
          <section style={{ border: "1.5px solid #d4af37", borderRadius: 22, padding: 20, background: "#fffdf7" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 24, color: "#000" }}>بيانات أدمن المدرسة</h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <span style={labelStyle}>طريقة ربط المدرسة</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    style={{
                      ...buttonStyle,
                      background: schoolMode === "existing" ? "linear-gradient(180deg, #f6df83, #d7b83e)" : "#fffdf7",
                    }}
                    disabled={!canWrite || !!editingEmail}
                    onClick={() => setSchoolMode("existing")}
                  >
                    اختيار من القائمة
                  </button>
                  <button
                    type="button"
                    style={{
                      ...buttonStyle,
                      background: schoolMode === "new" ? "linear-gradient(180deg, #f6df83, #d7b83e)" : "#fffdf7",
                    }}
                    disabled={!canWrite || !!editingEmail}
                    onClick={() => setSchoolMode("new")}
                  >
                    إضافة مدرسة جديدة
                  </button>
                </div>
              </div>

              {schoolMode === "existing" ? (
                <SelectField label="المدرسة" value={selectedTenantId} onChange={setSelectedTenantId} disabled={!canWrite || loading}>
                  <option value="">اختر مدرسة</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name} — {tenant.id}</option>
                  ))}
                </SelectField>
              ) : (
                <div style={{ display: "grid", gap: 16, border: "1px dashed #d4af37", borderRadius: 16, padding: 14, background: "#fffaf0" }}>
                  <Field label="اسم المدرسة الجديدة" value={newSchoolName} disabled={!canWrite || !!editingEmail} placeholder="مثال: مدرسة عزان للتعليم الأساسي" onChange={setNewSchoolName} />
                  <Field label="معرف المدرسة / Tenant ID اختياري" value={newSchoolTenantId} disabled={!canWrite || !!editingEmail} placeholder="اتركه فارغًا ليتم إنشاؤه تلقائيًا" onChange={setNewSchoolTenantId} />
                  <Field label="المحافظة / النطاق" value={newSchoolGovernorate} disabled={!canWrite || (!isOwner && !!myGov)} placeholder="المحافظة أو المديرية" onChange={setNewSchoolGovernorate} />
                </div>
              )}

              <Field label="البريد الإلكتروني" value={adminEmail} disabled={!canWrite || !!editingEmail} placeholder="school-admin@example.com" onChange={setAdminEmail} />
              <Field label="اسم الأدمن" value={adminName} disabled={!canWrite} placeholder="اسم أدمن المدرسة" onChange={setAdminName} />

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={enabled} disabled={!canWrite} onChange={(e) => setEnabled(e.target.checked)} />
                مفعل
              </label>

              <button style={{ ...buttonStyle, width: "100%", opacity: saving || !canWrite ? 0.72 : 1 }} disabled={saving || !canWrite} onClick={saveAdmin}>
                {saving ? "جارٍ الحفظ..." : editingEmail ? "حفظ التعديل" : "حفظ وربط أدمن المدرسة"}
              </button>
              {editingEmail ? (
                <button style={{ ...buttonStyle, background: "#fff" }} disabled={saving} onClick={resetForm}>إلغاء التعديل</button>
              ) : null}
            </div>
          </section>

          <section style={{ border: "1.5px solid #d4af37", borderRadius: 22, padding: 20, background: "#fffdf7", overflow: "hidden" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 24, color: "#000" }}>أدمنات المدارس المسجلون</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, color: "#000" }}>
                <thead>
                  <tr style={{ background: "#f5e6ad" }}>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>البريد</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>الاسم</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>المدرسة</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>المحافظة</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>الحالة</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length ? admins.map((row) => (
                    <tr key={`${row.email}-${row.tenantId}`}>
                      <td style={{ padding: 12, border: "1px solid #ead896", fontWeight: 850 }}>{row.email}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.name || "—"}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.tenantName || row.tenantId}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.governorate || "—"}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.enabled ? "مفعل" : "غير مفعل"}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896", whiteSpace: "nowrap" }}>
                        <button style={{ ...buttonStyle, padding: "8px 12px", marginInlineEnd: 8 }} disabled={!canWrite} onClick={() => startEdit(row)}>تعديل</button>
                        <button style={{ ...buttonStyle, padding: "8px 12px", background: "#fee2e2", borderColor: "#ef4444" }} disabled={!canWrite} onClick={() => void deleteAdmin(row)}>حذف</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: "center", border: "1px solid #ead896", fontWeight: 900 }}>
                        لا توجد سجلات ظاهرة حتى الآن.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
