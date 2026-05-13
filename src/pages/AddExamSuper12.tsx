// src/pages/AddExamSuper12.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import { buildAuthzSnapshot, isPlatformOwner } from "../features/authz";
import { MINISTRY_SCOPE } from "../constants/directorates";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAM_SUPER_LINKS_COLLECTION = "governorateExamSupers";
const EXAM_SUPER_ROLE_VALUES = new Set([
  "exam_super",
  "exam-super",
  "examcenter_super",
  "exam_center_super",
  "exam_center_admin",
  "diploma_exam_super",
  "diploma_center_super",
  "diploma_center_admin",
]);

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

const safeLinkId = (email: unknown, tenantId: unknown) => {
  const mail = String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/gi, "_");
  const tenant =
    String(tenantId || "")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_") || "no_tenant";
  return `${mail}__${tenant}`;
};

const safeTenantIdFromName = (value: unknown) => {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return base || `exam-center-${Date.now()}`;
};

const BLACK_FORM_CSS = `
.add-exam-super12-page,
.add-exam-super12-page * {
  color: #111827;
  -webkit-text-fill-color: #111827;
  box-sizing: border-box;
}
.add-exam-super12-page input,
.add-exam-super12-page select,
.add-exam-super12-page textarea,
.add-exam-super12-page option {
  color: #111827 !important;
  -webkit-text-fill-color: #111827 !important;
  background: #ffffff !important;
  font-weight: 850 !important;
}
.add-exam-super12-page input::placeholder,
.add-exam-super12-page textarea::placeholder {
  color: #6b7280 !important;
  -webkit-text-fill-color: #6b7280 !important;
}
.add-exam-super12-page select:disabled,
.add-exam-super12-page input:disabled {
  color: #374151 !important;
  -webkit-text-fill-color: #374151 !important;
  background: #f3ead0 !important;
}
`;

const getGovernorateValue = (...items: any[]) => {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.gov ??
          item?.scopeGovernorate ??
          "";
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const sameGovernorate = (a: unknown, b: unknown) =>
  normalize(a) === normalize(b);

const isExamSuperRecord = (record: any) => {
  const values = [
    record?.role,
    record?.originalRole,
    record?.userRole,
    record?.permissionRole,
    record?.scopeType,
  ]
    .map(normalize)
    .filter(Boolean);

  return (
    record?.isExamSuper === true ||
    record?.examSuper === true ||
    values.some((value) => EXAM_SUPER_ROLE_VALUES.has(value))
  );
};

const isExamCenterTenant = (tenant: any) => {
  const values = [
    tenant?.tenantType,
    tenant?.type,
    tenant?.entityType,
    tenant?.kind,
    tenant?.category,
  ]
    .map(normalize)
    .filter(Boolean);

  return (
    tenant?.isExamCenter === true ||
    tenant?.isDiplomaCenter === true ||
    values.some((v) =>
      [
        "exam_center",
        "exam-center",
        "examcenter",
        "diploma_center",
        "diploma-center",
        "diplomacenter",
        "center",
        "centre",
      ].includes(v),
    )
  );
};

type ExamCenterRow = {
  id: string;
  name: string;
  governorate: string;
  enabled: boolean;
};

type ExamSuperRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  centerName: string;
  governorate: string;
  enabled: boolean;
};

const buildExamSuperPayload = (params: {
  email: string;
  name: string;
  tenantId: string;
  centerName: string;
  governorate: string;
  enabled: boolean;
  createdBy: string;
}) => ({
  email: params.email,
  role: "exam_super",
  originalRole: "exam_super",
  enabled: params.enabled,
  active: params.enabled,
  userName: params.name,
  name: params.name,
  tenantId: params.tenantId,
  schoolName: params.centerName,
  tenantName: params.centerName,
  centerName: params.centerName,
  centerNameAr: params.centerName,
  governorate: params.governorate,
  tenantGovernorate: params.governorate,
  regionAr: params.governorate,
  scopeType: "exam_center",
  tenantType: "exam_center",
  type: "exam_center",
  entityType: "exam_center",
  isExamCenter: true,
  isDiplomaCenter: true,
  createdBy: params.createdBy,
  updatedAt: serverTimestamp(),
});

export default function AddExamSuper12() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, allow, profile } = auth;

  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const owner = isPlatformOwner(authzSnapshot);
  const currentRole = String(
    allow?.role || profile?.role || authzSnapshot?.roles?.[0] || "",
  )
    .trim()
    .toLowerCase();
  const currentGovernorate = getGovernorateValue(allow, profile, authzSnapshot as any);
  const isMinistryViewer = !owner && currentGovernorate === MINISTRY_SCOPE;
  const isGovernorateSupervisor =
    !owner && !isMinistryViewer && currentRole === "super" && !!currentGovernorate;
  const canUsePage = owner || isGovernorateSupervisor;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [centerMode, setCenterMode] = useState<"existing" | "new">("existing");
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterId, setNewCenterId] = useState("");
  const [newCenterGovernorate, setNewCenterGovernorate] = useState(currentGovernorate || "");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [centers, setCenters] = useState<ExamCenterRow[]>([]);
  const [rows, setRows] = useState<ExamSuperRow[]>([]);
  const [rowsWarning, setRowsWarning] = useState("");

  const selectedCenter = useMemo(
    () => centers.find((center) => center.id === selectedCenterId) || null,
    [centers, selectedCenterId],
  );

  useEffect(() => {
    if (!owner && currentGovernorate) setNewCenterGovernorate(currentGovernorate);
  }, [currentGovernorate, owner]);

  const loadCenters = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "tenants"));
      const list: ExamCenterRow[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const row = { id: docSnap.id, ...data } as any;
        if (!isExamCenterTenant(row)) return;

        const governorate = getGovernorateValue(row);
        if (!owner && !sameGovernorate(governorate, currentGovernorate)) return;

        list.push({
          id: docSnap.id,
          name: String(data?.name || data?.centerName || data?.schoolName || docSnap.id),
          governorate,
          enabled: data?.enabled !== false,
        });
      });

      list.sort((a, b) =>
        `${a.governorate} ${a.name}`.localeCompare(`${b.governorate} ${b.name}`, "ar"),
      );
      setCenters(list);
    } catch (error) {
      console.error(error);
      alert("تعذر تحميل مراكز امتحانات الدبلوم. تأكد من الصلاحيات أو الاتصال بالسحابة.");
    } finally {
      setLoading(false);
    }
  };

  const loadExamSupers = async () => {
    const merged = new Map<string, ExamSuperRow>();
    const warnings: string[] = [];

    const addRow = (id: string, data: any, forceInclude = false) => {
      if (!forceInclude && !isExamSuperRecord(data)) return;

      const email = String(data?.email || id || "").trim().toLowerCase();
      const tenantId = String(data?.tenantId || data?.centerId || data?.examCenterId || "").trim();
      const governorate = getGovernorateValue(data);

      if (!owner && !sameGovernorate(governorate, currentGovernorate)) return;

      const key = `${email || id}__${tenantId || "no_tenant"}`;
      merged.set(key, {
        id: String(id || key),
        email,
        name: String(data?.name || data?.userName || data?.displayName || ""),
        tenantId,
        centerName: String(
          data?.centerName ||
            data?.centerNameAr ||
            data?.tenantName ||
            data?.schoolName ||
            data?.examCenterName ||
            tenantId ||
            "",
        ),
        governorate,
        enabled: data?.enabled !== false && data?.active !== false,
      });
    };

    setRowsWarning("");

    try {
      const linksBase = collection(db, EXAM_SUPER_LINKS_COLLECTION);
      const linksSnap = owner
        ? await getDocs(linksBase)
        : await getDocs(query(linksBase, where("governorate", "==", currentGovernorate)));

      linksSnap.forEach((docSnap) => {
        addRow(docSnap.id, docSnap.data() as any, true);
      });
    } catch (error) {
      console.warn("Cannot load governorate exam supers links", error);
      warnings.push("تعذر قراءة جدول ربط سوبر الامتحانات، وسيتم عرض ما يمكن قراءته فقط.");
    }

    try {
      let allowlistSnap;
      if (owner) {
        allowlistSnap = await getDocs(collection(db, "allowlist"));
      } else {
        try {
          allowlistSnap = await getDocs(
            query(collection(db, "allowlist"), where("governorate", "==", currentGovernorate)),
          );
        } catch {
          allowlistSnap = await getDocs(
            query(collection(db, "allowlist"), where("tenantGovernorate", "==", currentGovernorate)),
          );
        }
      }

      allowlistSnap.forEach((docSnap) => {
        addRow(docSnap.id, docSnap.data() as any, false);
      });
    } catch (error) {
      console.warn("Cannot load old exam supers from allowlist", error);
      warnings.push("تعذر قراءة بعض السجلات القديمة من allowlist بسبب الصلاحيات. هذا لا يمنع إضافة سوبر امتحانات جديد.");
    }

    const list = Array.from(merged.values()).sort((a, b) =>
      `${a.governorate} ${a.centerName} ${a.email}`.localeCompare(
        `${b.governorate} ${b.centerName} ${b.email}`,
        "ar",
      ),
    );

    setRows(list);
    setRowsWarning(warnings.join(" "));
  };

  useEffect(() => {
    if (!canUsePage) return;
    void loadCenters();
    void loadExamSupers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsePage, currentGovernorate, owner]);

  if (!user) return <Navigate to="/login" replace />;

  const createOrResolveNewCenter = async (): Promise<ExamCenterRow> => {
    const centerName = String(newCenterName || "").trim();
    const governorate = String(owner ? newCenterGovernorate : currentGovernorate || newCenterGovernorate).trim();
    const centerId = safeTenantIdFromName(newCenterId || centerName);

    if (!centerName) {
      throw new Error("يرجى إدخال اسم مركز امتحانات الدبلوم الجديد.");
    }
    if (!governorate) {
      throw new Error("يرجى إدخال المحافظة / النطاق للمركز الجديد.");
    }
    if (!owner && !sameGovernorate(governorate, currentGovernorate)) {
      throw new Error("لا يمكن إنشاء مركز خارج نطاق محافظتك.");
    }

    const centerRef = doc(db, "tenants", centerId);
    const centerSnap = await getDoc(centerRef);

    if (centerSnap.exists()) {
      const existing = { id: centerSnap.id, ...(centerSnap.data() as any) };
      if (!isExamCenterTenant(existing)) {
        throw new Error("يوجد tenant بنفس المعرف لكنه ليس مركز امتحانات دبلوم. اختر معرفًا آخر.");
      }

      const existingGovernorate = getGovernorateValue(existing);
      if (!owner && !sameGovernorate(existingGovernorate, currentGovernorate)) {
        throw new Error("يوجد مركز بنفس المعرف خارج نطاق محافظتك.");
      }

      const ok = window.confirm("يوجد مركز امتحانات بنفس المعرف. هل تريد استخدامه وربط السوبر به؟");
      if (!ok) throw new Error("تم إلغاء استخدام المركز الموجود.");

      return {
        id: centerSnap.id,
        name: String((existing as any)?.name || (existing as any)?.centerName || centerName),
        governorate: existingGovernorate || governorate,
        enabled: (existing as any)?.enabled !== false,
      };
    }

    await setDoc(centerRef, {
      id: centerId,
      name: centerName,
      centerName,
      centerNameAr: centerName,
      schoolName: centerName,
      tenantName: centerName,
      governorate,
      tenantGovernorate: governorate,
      regionAr: governorate,
      scopeGovernorate: governorate,
      enabled: true,
      active: true,
      tenantType: "exam_center",
      type: "exam_center",
      entityType: "exam_center",
      kind: "exam_center",
      category: "exam_center",
      isExamCenter: true,
      isDiplomaCenter: true,
      createdBy: String(user?.email || ""),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const createdCenter = { id: centerId, name: centerName, governorate, enabled: true };
    setCenters((prev) => {
      const next = prev.filter((item) => item.id !== centerId).concat(createdCenter);
      next.sort((a, b) => `${a.governorate} ${a.name}`.localeCompare(`${b.governorate} ${b.name}`, "ar"));
      return next;
    });
    setSelectedCenterId(centerId);

    return createdCenter;
  };

  const saveExamSuper = async () => {
    if (!canUsePage) {
      alert("هذه الصفحة متاحة لمالك المنصة أو مشرف المحافظة فقط.");
      return;
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(name || "").trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      alert("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }
    if (!normalizedName) {
      alert("يرجى إدخال اسم المستخدم.");
      return;
    }
    let centerForSave: ExamCenterRow | null = null;

    setBusy(true);
    try {
      centerForSave =
        centerMode === "new" ? await createOrResolveNewCenter() : selectedCenter;

      if (!centerForSave) {
        alert("اختر مركز امتحانات دبلوم من القائمة أو أضف مركزًا جديدًا أولاً.");
        return;
      }
      if (!centerForSave.enabled) {
        alert("لا يمكن ربط سوبر امتحانات بمركز غير مفعل.");
        return;
      }

      const centerGovernorate = getGovernorateValue(centerForSave);
      if (!owner && !sameGovernorate(centerGovernorate, currentGovernorate)) {
        alert("لا يمكن ربط سوبر امتحانات بمركز خارج نطاق محافظتك.");
        return;
      }
      const existingSnap = await getDoc(doc(db, "allowlist", normalizedEmail));
      if (existingSnap.exists()) {
        const existing = existingSnap.data() as any;
        const existingTenantId = String(existing?.tenantId || "").trim();
        const existingRole = String(existing?.role || "").trim();
        if (existingTenantId && existingTenantId !== centerForSave.id) {
          const ok = window.confirm(
            `هذا البريد مرتبط مسبقًا بـ ${existing?.tenantName || existingTenantId} بصلاحية ${existingRole || "غير محددة"}. هل تريد تحديث الربط إلى المركز المختار؟`,
          );
          if (!ok) return;
        }
      }

      const payload = buildExamSuperPayload({
        email: normalizedEmail,
        name: normalizedName,
        tenantId: centerForSave.id,
        centerName: centerForSave.name,
        governorate: centerGovernorate || currentGovernorate,
        enabled,
        createdBy: String(user?.email || ""),
      });

      await setDoc(
        doc(db, "allowlist", normalizedEmail),
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        doc(db, EXAM_SUPER_LINKS_COLLECTION, safeLinkId(normalizedEmail, centerForSave.id)),
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      setEmail("");
      setName("");
      setSelectedCenterId("");
      setCenterMode("existing");
      setNewCenterName("");
      setNewCenterId("");
      setNewCenterGovernorate(currentGovernorate || "");
      setEnabled(true);
      await loadExamSupers();
      alert("تم حفظ سوبر الامتحانات وربطه بمركز الدبلوم بنجاح.");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      alert(message || "تعذر حفظ سوبر الامتحانات. تأكد من الصلاحيات ثم جرّب مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="add-exam-super12-page"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8f2e4 0%, #efe3c8 100%)",
        color: "#111827",
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style>{BLACK_FORM_CSS}</style>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            border: "1.5px solid #c9aa55",
            borderRadius: 22,
            background: "rgba(255, 252, 242, 0.96)",
            boxShadow: "0 16px 36px rgba(80, 60, 20, 0.12)",
            padding: 22,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 18,
            alignItems: "center",
          }}
        >
          <img src={MINISTRY_LOGO_URL} alt="وزارة التربية والتعليم" style={{ width: 76, height: 76, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 950 }}>إضافة سوبر امتحانات لمركز دبلوم</div>
            <div style={{ marginTop: 6, color: "#374151", fontWeight: 800 }}>
              ربط سوبر امتحانات بمركز امتحانات دبلوم داخل نطاق المحافظة.
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/super-system")}
            style={{
              border: "1px solid #b8870b",
              borderRadius: 12,
              background: "#fff7df",
              padding: "12px 18px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            العودة للبوابة الإشرافية
          </button>
        </div>

        {!canUsePage ? (
          <div
            style={{
              border: "1px solid #ef4444",
              borderRadius: 18,
              background: "#fff1f2",
              padding: 18,
              fontWeight: 900,
              color: "#7f1d1d",
            }}
          >
            هذه الصفحة متاحة فقط لمالك المنصة أو مشرف المحافظة.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
            gap: 18,
          }}
        >
          <section
            style={{
              border: "1.5px solid #c9aa55",
              borderRadius: 20,
              background: "#fffdf7",
              padding: 20,
              boxShadow: "0 10px 24px rgba(80,60,20,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 22 }}>بيانات سوبر الامتحانات</h2>

            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                البريد الإلكتروني
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canUsePage || busy}
                  placeholder="exam-super@example.com"
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                الاسم
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canUsePage || busy}
                  placeholder="اسم سوبر الامتحانات"
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                المحافظة / النطاق
                <input
                  value={owner ? "حسب مركز الدبلوم المختار" : currentGovernorate}
                  readOnly
                  style={{ ...fieldStyle, background: "#f7efd6" }}
                />
              </label>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 950 }}>مركز امتحانات الدبلوم</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    disabled={!canUsePage || busy}
                    onClick={() => setCenterMode("existing")}
                    style={centerMode === "existing" ? activeToggleStyle : toggleStyle}
                  >
                    اختيار من القائمة
                  </button>
                  <button
                    type="button"
                    disabled={!canUsePage || busy}
                    onClick={() => setCenterMode("new")}
                    style={centerMode === "new" ? activeToggleStyle : toggleStyle}
                  >
                    إضافة مركز جديد
                  </button>
                </div>

                {centerMode === "existing" ? (
                  <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                    اختر مركزًا موجودًا
                    <select
                      value={selectedCenterId}
                      onChange={(e) => setSelectedCenterId(e.target.value)}
                      disabled={!canUsePage || busy || loading}
                      style={fieldStyle}
                    >
                      <option value="">اختر مركز دبلوم</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name} — {center.governorate || "بدون محافظة"} — {center.id}
                        </option>
                      ))}
                    </select>
                    {!centers.length ? (
                      <span style={{ color: "#9f1239", fontSize: 13, fontWeight: 800 }}>
                        لا توجد مراكز دبلوم داخل النطاق. يمكنك إضافة مركز جديد من هذا النموذج.
                      </span>
                    ) : null}
                  </label>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      border: "1px solid #ead69b",
                      borderRadius: 14,
                      background: "#fff9e8",
                      padding: 14,
                    }}
                  >
                    <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                      اسم مركز امتحانات الدبلوم الجديد
                      <input
                        value={newCenterName}
                        onChange={(e) => setNewCenterName(e.target.value)}
                        disabled={!canUsePage || busy}
                        placeholder="مثال: مركز امتحانات دبلوم التعليم العام بعزان"
                        style={fieldStyle}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                      معرف المركز / tenantId اختياري
                      <input
                        value={newCenterId}
                        onChange={(e) => setNewCenterId(e.target.value)}
                        disabled={!canUsePage || busy}
                        placeholder="اتركه فارغًا ليتم إنشاؤه تلقائيًا"
                        style={fieldStyle}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 7, fontWeight: 900 }}>
                      المحافظة / النطاق للمركز الجديد
                      <input
                        value={owner ? newCenterGovernorate : currentGovernorate}
                        onChange={(e) => setNewCenterGovernorate(e.target.value)}
                        disabled={!canUsePage || busy || !owner}
                        placeholder="اسم المحافظة"
                        style={{ ...fieldStyle, background: owner ? "#ffffff" : "#f7efd6" }}
                      />
                    </label>

                    <span style={{ color: "#7c5b07", fontSize: 13, fontWeight: 850 }}>
                      سيتم إنشاء المركز كـ مركز امتحانات دبلوم ثم ربط سوبر الامتحانات به مباشرة.
                    </span>
                  </div>
                )}
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={!canUsePage || busy}
                />
                مفعل
              </label>

              <button
                type="button"
                disabled={!canUsePage || busy}
                onClick={() => void saveExamSuper()}
                style={{
                  border: "1px solid #9b750e",
                  borderRadius: 12,
                  background: busy ? "#e5e7eb" : "linear-gradient(180deg, #f8d66d, #d4af37)",
                  padding: "13px 18px",
                  fontWeight: 950,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "جارٍ الحفظ..." : "حفظ سوبر الامتحانات"}
              </button>
            </div>
          </section>

          <section
            style={{
              border: "1.5px solid #c9aa55",
              borderRadius: 20,
              background: "#fffdf7",
              padding: 20,
              boxShadow: "0 10px 24px rgba(80,60,20,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>سوبر الامتحانات المسجلون</h2>
              <button type="button" onClick={() => void loadExamSupers()} style={smallButtonStyle}>
                تحديث
              </button>
            </div>


              {rowsWarning ? (
                <div
                  style={{
                    marginBottom: 12,
                    border: "1px solid #f59e0b",
                    borderRadius: 12,
                    background: "#fff7ed",
                    color: "#7c2d12",
                    padding: "10px 12px",
                    fontWeight: 850,
                    lineHeight: 1.7,
                  }}
                >
                  {rowsWarning}
                </div>
              ) : null}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ background: "#f3e5b6" }}>
                    <th style={thStyle}>البريد</th>
                    <th style={thStyle}>الاسم</th>
                    <th style={thStyle}>مركز الدبلوم</th>
                    <th style={thStyle}>المحافظة</th>
                    <th style={thStyle}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.email}</td>
                        <td style={tdStyle}>{row.name || "—"}</td>
                        <td style={tdStyle}>{row.centerName || row.tenantId}</td>
                        <td style={tdStyle}>{row.governorate || "—"}</td>
                        <td style={tdStyle}>{row.enabled ? "مفعل" : "غير مفعل"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: "center", padding: 18 }}>
                        لا توجد سجلات حتى الآن، أو أن السجلات القديمة محفوظة بصلاحية مختلفة. اضغط تحديث بعد التأكد من الصلاحيات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  border: "1.5px solid #c9aa55",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 850,
  outline: "none",
};

const toggleStyle: React.CSSProperties = {
  border: "1px solid #c9aa55",
  borderRadius: 12,
  background: "#ffffff",
  color: "#111827",
  padding: "11px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const activeToggleStyle: React.CSSProperties = {
  ...toggleStyle,
  border: "2px solid #9b750e",
  background: "linear-gradient(180deg, #fff3c4, #f3d36c)",
};

const smallButtonStyle: React.CSSProperties = {
  border: "1px solid #b8870b",
  borderRadius: 10,
  background: "#fff7df",
  padding: "9px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d6c58a",
  padding: 10,
  textAlign: "right",
  color: "#111827",
  fontWeight: 950,
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #e2d3a3",
  padding: 10,
  color: "#111827",
  fontWeight: 800,
};
