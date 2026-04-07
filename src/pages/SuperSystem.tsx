// src/pages/SuperSystem.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "./superSystem.theme.css";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  setDoc,
} from "firebase/firestore";

import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  isPlatformOwner,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { getActionErrorMessage } from "../services/functionsRuntimePolicy";
import { MINISTRY_SCOPE } from "../constants/directorates";
import { useSuperSystemTenants } from "../features/super-admin/hooks/useSuperSystemTenants";
import {
  archiveAndDeleteTenant,
  createTenantForScope,
  loadTenantEditState,
  saveTenantAdminAssignment,
  saveTenantForScope,
} from "../features/super-admin/services/superSystemService";

const safeId = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type TenantAdminLinkRow = {
  tenantId: string;
  tenantName: string;
  email: string;
};

export default function SuperSystem() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, allow, logout } = auth;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const roleBadge = resolveRoleBadgeStyle(authzSnapshot);
  const isOwner = isPlatformOwner(authzSnapshot);
  const canManageSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");

  if (!user) return <Navigate to="/login" replace />;
  if (!allow?.enabled) return <Navigate to="/login" replace />;
  if (!canManageSystem) return <Navigate to="/" replace />;

  const myGov = String(allow?.governorate ?? "").trim();
  const canSeeAllGovs = isOwner || myGov === MINISTRY_SCOPE;

  const {
    tenants,
    setTenants,
    search,
    setSearch,
    selectedTenantId,
    setSelectedTenantId,
    visibleTenants,
    selectedTenant,
  } = useSuperSystemTenants({ canSeeAllGovs, myGov });

  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantEnabled, setEditTenantEnabled] = useState(true);
  const [editWilayatAr, setEditWilayatAr] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editReloadTick, setEditReloadTick] = useState(0);

  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newTenantEnabled, setNewTenantEnabled] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userEnabled, setUserEnabled] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  const [tenantAdminRows, setTenantAdminRows] = useState<TenantAdminLinkRow[]>([]);
  const [tenantAdminBusy, setTenantAdminBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const isEmailAlreadyLinkedToAnotherSchool = async (emailValue: string, tenantIdValue: string) => {
    const email = String(emailValue || "").trim().toLowerCase();
    const tenantId = String(tenantIdValue || "").trim();
    if (!email || !tenantId) return false;

    const existingSnap = await getDoc(doc(db, "allowlist", email));
    if (!existingSnap.exists()) return false;

    const existingData = existingSnap.data() as any;
    const existingTenantId = String(existingData?.tenantId || "").trim();

    if (!existingTenantId) return false;
    return existingTenantId !== tenantId;
  };


  const exportTenantAdminLinksToExcel = () => {
    const rows = [...tenantAdminRows];

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <tr>
              <th>Tenant ID</th>
              <th>اسم المدرسة</th>
              <th>البريد الإلكتروني المرتبط</th>
            </tr>
            ${rows
              .map(
                (r) => `
              <tr>
                <td>${String(r.tenantId || "")}</td>
                <td>${String(r.tenantName || "")}</td>
                <td>${String(r.email || "")}</td>
              </tr>
            `
              )
              .join("")}
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenant-admin-links.xls";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const parseExcelLikeFile = async (file: File): Promise<TenantAdminLinkRow[]> => {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const rows: TenantAdminLinkRow[] = [];
    const separator = lines[0].includes("\t") ? "\t" : ",";

    const rawRows = lines.map((line) => line.split(separator).map((cell) => cell.trim()));
    const header = rawRows[0].map((h) => h.toLowerCase());

    const tenantIdIndex = header.findIndex((h) => h.includes("tenant"));
    const tenantNameIndex = header.findIndex((h) => h.includes("اسم المدرسة") || h.includes("school"));
    const emailIndex = header.findIndex((h) => h.includes("البريد") || h.includes("email"));

    const startAt =
      tenantIdIndex >= 0 || tenantNameIndex >= 0 || emailIndex >= 0 ? 1 : 0;

    for (let i = startAt; i < rawRows.length; i++) {
      const cols = rawRows[i];
      const row: TenantAdminLinkRow = {
        tenantId: String(cols[tenantIdIndex >= 0 ? tenantIdIndex : 0] || "").trim(),
        tenantName: String(cols[tenantNameIndex >= 0 ? tenantNameIndex : 1] || "").trim(),
        email: String(cols[emailIndex >= 0 ? emailIndex : 2] || "").trim(),
      };

      if (!row.tenantId || !row.email) continue;
      rows.push(row);
    }

    return rows;
  };

  const importTenantAdminLinksFromExcel = async (file: File) => {
    setImportBusy(true);
    try {
      const importedRows = await parseExcelLikeFile(file);

      if (!importedRows.length) {
        alert("لم يتم العثور على بيانات صالحة داخل الملف.");
        return;
      }

      for (const row of importedRows) {
        const tenantId = String(row.tenantId || "").trim();
        const email = String(row.email || "").trim().toLowerCase();
        if (!tenantId || !email) continue;

        const tenantDocRef = doc(db, "tenants", tenantId);
        const tenantDocSnap = await getDoc(tenantDocRef);
        const tenantDocData = tenantDocSnap.exists() ? (tenantDocSnap.data() as any) : null;

        if (!tenantDocData) continue;

        const tenantGovernorate = String(tenantDocData?.governorate || "");
        if (!canSeeAllGovs && tenantGovernorate !== String(myGov || "")) {
          continue;
        }

        const alreadyLinked = await isEmailAlreadyLinkedToAnotherSchool(email, tenantId);
        if (alreadyLinked) {
          continue;
        }

        await setDoc(
          doc(db, "allowlist", email),
          {
            email,
            enabled: true,
            role: "admin",
            tenantId,
            tenantName: row.tenantName || tenantDocData?.name || tenantId,
            tenantGovernorate,
          },
          { merge: true }
        );
      }

      setEditReloadTick((x) => x + 1);
      alert("تم استيراد بيانات الجدول بنجاح.");
    } catch (e) {
      console.error(e);
      alert("تعذر استيراد الملف. تأكد من أن الملف بصيغة CSV أو Excel محفوظ كنص قابل للقراءة.");
    } finally {
      setImportBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const deleteTenantAdminLink = async (row: TenantAdminLinkRow) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) return;

    const ok = confirm(
      `تأكيد حذف ربط المدرسة (${row.tenantName || row.tenantId}) مع البريد (${email})؟`
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "allowlist", email));
      setTenantAdminRows((prev) =>
        prev.filter(
          (item) =>
            !(
              String(item.tenantId || "") === String(row.tenantId || "") &&
              String(item.email || "").toLowerCase() === email
            )
        )
      );
      alert("تم حذف الربط من الجدول بنجاح.");
    } catch (e) {
      console.error(e);
      alert("تعذر حذف الربط. تأكد من الصلاحيات ثم جرّب مرة أخرى.");
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!selectedTenantId) return;
      try {
        const state = await loadTenantEditState(selectedTenantId);
        setEditTenantName(state.name);
        setEditTenantEnabled(state.enabled);
        setEditWilayatAr(state.wilayatAr);
        setEditLogoUrl(state.logoUrl);
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [selectedTenantId, editReloadTick]);

  useEffect(() => {
    const run = async () => {
      setTenantAdminBusy(true);
      try {
        const allowRef = collection(db, "allowlist");

        const tenantsMap = new Map(
          tenants.map((t) => [
            String(t.id || "").trim(),
            {
              tenantName: String(t.name || t.id || ""),
              governorate: String((t as any).governorate || ""),
            },
          ])
        );

        const q = query(allowRef, where("role", "==", "admin"));
        const snap = await getDocs(q);

        const rows: TenantAdminLinkRow[] = [];

        for (const docSnap of snap.docs as QueryDocumentSnapshot<DocumentData>[]) {
          const data = docSnap.data() as any;
          const tenantId = String(data?.tenantId || "").trim();
          if (!tenantId) continue;

          const tenantMeta = tenantsMap.get(tenantId);
          if (!tenantMeta) continue;

          if (
            !canSeeAllGovs &&
            String(tenantMeta.governorate || "") !== String(myGov || "")
          ) {
            continue;
          }

          const tenantDocRef = doc(db, "tenants", tenantId);
          const tenantDocSnap = await getDoc(tenantDocRef);
          const tenantDocData = tenantDocSnap.exists()
            ? (tenantDocSnap.data() as any)
            : {};

          rows.push({
            tenantId,
            tenantName: String(
              tenantDocData?.name || tenantMeta.tenantName || tenantId
            ),
            email: String(data?.email || docSnap.id || ""),
          });
        }

        setTenantAdminRows(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setTenantAdminBusy(false);
      }
    };

    run();
  }, [tenants, canSeeAllGovs, myGov, editReloadTick, selectedTenantId]);

  const createTenant = async () => {
    try {
      const result = await createTenantForScope({
        tenantId: newTenantId,
        name: newTenantName,
        enabled: newTenantEnabled,
        canSeeAllGovs,
        myGov,
      });
      setNewTenantName("");
      setNewTenantId("");
      setNewTenantEnabled(true);
      setSelectedTenantId(result.tenantId);
      setEditReloadTick((x: number) => x + 1);
      alert("تم إنشاء المدرسة بنجاح ✅");
    } catch (e: any) {
      console.error(e);
      if (String(e?.message || "") === "TENANT_EXISTS") {
        alert("Tenant ID مستخدم بالفعل. اختر Tenant ID جديد.");
      } else if (String(e?.message || "") === "MISSING_GOVERNORATE") {
        alert("حساب السوبر غير مرتبط بمحافظة.");
      } else {
        alert(
          getActionErrorMessage(
            e,
            "تعذر إنشاء المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."
          )
        );
      }
    }
  };

  const saveSelectedTenant = async () => {
    if (!selectedTenantId) {
      alert("اختر مدرسة أولاً.");
      return;
    }

    const name = String(editTenantName || "").trim();
    if (!name) {
      alert("يرجى إدخال اسم المدرسة.");
      return;
    }

    setEditBusy(true);
    try {
      await saveTenantForScope({
        tenantId: selectedTenantId,
        name,
        enabled: editTenantEnabled,
        wilayatAr: editWilayatAr,
        logoUrl: editLogoUrl,
        canSeeAllGovs,
        myGov,
      });
      setEditReloadTick((x: number) => x + 1);
      alert("تم حفظ بيانات المدرسة بنجاح.");
    } catch (e: any) {
      console.error(e);
      alert(
        getActionErrorMessage(
          e,
          "تعذر حفظ بيانات المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."
        )
      );
    } finally {
      setEditBusy(false);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    const id = String(tenantId || "").trim();
    if (!id) return;
    if (!confirm(`تأكيد حذف المدرسة (${id})؟`)) return;

    try {
      await archiveAndDeleteTenant({
        tenantId: id,
        deletedBy: String(user?.email || ""),
      });
      setTenants((prev) => prev.filter((t) => t.id !== id));
      if (selectedTenantId === id) setSelectedTenantId("");
      setEditReloadTick((x: number) => x + 1);
      alert("تم حذف المدرسة بنجاح.");
    } catch (e) {
      console.error(e);
      alert(
        getActionErrorMessage(
          e,
          "تعذر حذف المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى."
        )
      );
    }
  };

  const saveAdminUser = async () => {
    const tenantId = String(selectedTenantId || "").trim();
    if (!tenantId) {
      alert("اختر مدرسة أولاً.");
      return;
    }

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      alert("المدرسة غير موجودة.");
      return;
    }

    if (!canSeeAllGovs && String(tenant.governorate || "") !== myGov) {
      alert("لا يمكنك إضافة مستخدم لمدرسة خارج محافظتك.");
      return;
    }

    setSaveBusy(true);
    try {
      const alreadyLinked = await isEmailAlreadyLinkedToAnotherSchool(userEmail, tenantId);
      if (alreadyLinked) {
        alert("لا يمكن ربط نفس البريد الإلكتروني بأكثر من مدرسة. البريد الإلكتروني يربط بمدرسة واحدة فقط.");
        return;
      }

      await saveTenantAdminAssignment({
        email: userEmail,
        enabled: userEnabled,
        tenantId,
        tenantName: tenant.name,
        tenantGovernorate: tenant.governorate,
        canSeeAllGovs,
        myGov,
        userName,
      });
      setUserEmail("");
      setUserName("");
      setUserEnabled(true);
      setEditReloadTick((x: number) => x + 1);
      alert("تم حفظ المستخدم بنجاح.");
    } catch (e: any) {
      console.error(e);
      alert(
        String(e?.message || "") === "INVALID_EMAIL"
          ? "يرجى إدخال بريد صحيح."
          : getActionErrorMessage(
              e,
              "تعذر حفظ المستخدم. تأكد من الصلاحيات ثم جرّب مرة أخرى."
            )
      );
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="super-system-page" dir="rtl">
      <div className="super-header">
        <div className="super-header-right super-brand">
          <img
            className="super-brand-logo"
            src={MINISTRY_LOGO_URL}
            alt="وزارة التعليم"
          />
          <div className="super-brand-text">
            <div className="super-brand-ministry">وزارة التعليم</div>
            <div className="super-brand-gov">{myGov || ""}</div>
          </div>
        </div>

        <div className="super-header-center">
          <div className="super-program-title">نظام إدارة الامتحانات المطور</div>
          <div className="super-subtitle">
            {isOwner
              ? "مالك المنصة داخل نطاق المحافظات"
              : canSeeAllGovs
              ? "عرض جميع المحافظات"
              : "مدير المحافظة - إدارة المدارس والمستخدمين"}
          </div>
        </div>

        <div className="super-header-left">
          {isOwner ? (
            <button className="super-btn" onClick={() => navigate("/system")}>
              لوحة مالك المنصة
            </button>
          ) : null}
          <button className="super-btn" onClick={() => navigate("/")}>
            العودة
          </button>
          <button className="super-btn danger" onClick={() => logout()}>
            تسجيل خروج
          </button>
        </div>
      </div>

      <div className="super-cards">
        <button
          className="super-card"
          onClick={() =>
            document.getElementById("section-tenants")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <div className="super-card-title">إدارة المدارس</div>
          <div className="super-card-desc">عرض/بحث المدارس + حذف/اختيار.</div>
        </button>

        <button
          className="super-card"
          onClick={() =>
            document.getElementById("section-edit")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <div className="super-card-title">تعديل بيانات المدرسة</div>
          <div className="super-card-desc">
            تعديل اسم المدرسة والشعار والولاية (داخل محافظتك).
          </div>
        </button>

        <button
          className="super-card"
          onClick={() =>
            document.getElementById("section-create")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <div className="super-card-title">إضافة مدرسة جديدة</div>
          <div className="super-card-desc">إنشاء مدرسة داخل محافظتك.</div>
        </button>

        <button
          className="super-card"
          onClick={() =>
            document.getElementById("section-admin")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <div className="super-card-title">ربط الأدمن</div>
          <div className="super-card-desc">إضافة/ربط Admin بمدرسة محددة.</div>
        </button>

        <button className="super-card" onClick={() => navigate("/")}>
          <div className="super-card-title">الدخول للبرنامج</div>
          <div className="super-card-desc">
            الانتقال للواجهة الرئيسية بعد اختيار المدرسة.
          </div>
        </button>
      </div>

      <div
        style={{
          marginBottom: 16,
          border: "1px solid rgba(212,175,55,0.28)",
          background: "rgba(0,0,0,0.32)",
          borderRadius: 16,
          padding: 14,
          color: "#f8fafc",
        }}
      >
        <div style={{ fontWeight: 900, color: "#d4af37", marginBottom: 6 }}>
          {roleBadge.label}
        </div>
        <div style={{ lineHeight: 1.8, opacity: 0.92 }}>
          {isOwner
            ? "أنت مالك المنصة، ويمكنك من هذه الشاشة مراجعة نطاق المحافظات بالكامل، كما يمكنك العودة إلى لوحة المالك لإدارة كل الصلاحيات العليا والمستخدمين والمدارس."
            : "أنت مشرف نطاق، لذلك ترى وتدير فقط المدارس والمستخدمين المرتبطين بنطاقك الإداري."}
        </div>
      </div>

      <div className="super-grid">
        <div className="super-panel" id="section-tenants">
          <div className="super-panel-title">إدارة المدارس (Tenants)</div>
          <div style={{ marginBottom: 10 }}>
            <input
              className="input"
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="tenant-list">
            {visibleTenants.map((t) => (
              <div
                key={t.id}
                className={`tenant-row ${selectedTenantId === t.id ? "active" : ""}`}
              >
                <button className="icon-btn" title="حذف" onClick={() => deleteTenant(t.id)}>
                  🗑️
                </button>
                <button
                  className="icon-btn"
                  title="اختيار"
                  onClick={() => setSelectedTenantId(t.id)}
                >
                  📁
                </button>
                <div className="tenant-meta" onClick={() => setSelectedTenantId(t.id)}>
                  <div className="tenant-name">{t.name || t.id}</div>
                  <div className="tenant-id">{t.id}</div>
                  <div className="tenant-id" style={{ opacity: 0.8 }}>
                    {t.governorate ? `المحافظة: ${t.governorate}` : ""}
                  </div>
                </div>
                <div
                  style={{
                    marginInlineStart: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ opacity: 0.9 }}>{t.enabled ? "مفعل" : "غير مفعل"}</span>
                  <input type="checkbox" checked={t.enabled !== false} readOnly />
                </div>
              </div>
            ))}
            {!visibleTenants.length ? (
              <div style={{ padding: 12, opacity: 0.8 }}>لا توجد مدارس.</div>
            ) : null}
          </div>
        </div>

        <div className="super-panel" id="section-edit">
          <div className="super-panel-title">تعديل بيانات المدرسة المختارة</div>
          {!selectedTenantId ? (
            <div style={{ padding: 12, opacity: 0.85 }}>اختر مدرسة من القائمة أولاً.</div>
          ) : (
            <div className="form-grid">
              <label className="label">Tenant ID</label>
              <input className="input" value={selectedTenantId} readOnly />

              <label className="label">اسم المدرسة</label>
              <input
                className="input"
                value={editTenantName}
                onChange={(e) => setEditTenantName(e.target.value)}
              />

              <label className="label">الحالة</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={editTenantEnabled !== false}
                  onChange={(e) => setEditTenantEnabled(e.target.checked)}
                />
                <span style={{ opacity: 0.9 }}>
                  {editTenantEnabled ? "مفعل" : "غير مفعل"}
                </span>
              </div>

              <label className="label">الولاية</label>
              <input
                className="input"
                value={editWilayatAr}
                onChange={(e) => setEditWilayatAr(e.target.value)}
                placeholder="مثال: بوشر"
              />

              <label className="label">رابط الشعار</label>
              <input
                className="input"
                value={editLogoUrl}
                onChange={(e) => setEditLogoUrl(e.target.value)}
                placeholder={MINISTRY_LOGO_URL}
              />

              <div />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn" disabled={editBusy} onClick={saveSelectedTenant}>
                  {editBusy ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={editBusy}
                  onClick={() => setEditReloadTick((x: number) => x + 1)}
                  title="إعادة تحميل البيانات"
                >
                  تحديث
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="super-panel" id="section-create">
          <div className="super-panel-title">إنشاء مدرسة جديدة (Tenant)</div>
          <div className="form-grid">
            <label className="label">اسم المدرسة</label>
            <input
              className="input"
              value={newTenantName}
              onChange={(e) => setNewTenantName(e.target.value)}
              placeholder="مثال: أزان 12-9"
            />

            <label className="label">Tenant ID (Subdomain)</label>
            <input
              className="input"
              value={newTenantId}
              onChange={(e) => setNewTenantId(safeId(e.target.value))}
              placeholder="مثال: azaan-9-12"
            />

            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="label">مفعل</span>
              <input
                type="checkbox"
                checked={newTenantEnabled}
                onChange={(e) => setNewTenantEnabled(e.target.checked)}
              />
            </div>

            <div />
            <button className="btn primary" onClick={createTenant}>
              إنشاء مدرسة جديدة
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
            {canSeeAllGovs ? (
              <div>السوبر أدمن يمكنه إنشاء مدارس لأي محافظة (حسب إعدادات المدرسة).</div>
            ) : (
              <div>
                سيتم تثبيت محافظة المدرسة تلقائيًا على: <b>{myGov || "غير محددة"}</b>
              </div>
            )}
          </div>
        </div>

        <div className="super-panel" id="section-admin">
          <div className="super-panel-title">إضافة/ربط Admin بالمدرسة</div>

          <div style={{ marginBottom: 10, opacity: 0.85 }}>
            المدرسة المحددة: <b>{selectedTenant?.name || selectedTenantId || "—"}</b>
          </div>

          <div className="form-grid">
            <label className="label">البريد الإلكتروني (مفتاح الوثيقة)</label>
            <input
              className="input"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="name@example.com"
            />

            <label className="label">الاسم (اختياري)</label>
            <input
              className="input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="اسم المستخدم"
            />

            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="label">مفعل</span>
              <input
                type="checkbox"
                checked={userEnabled}
                onChange={(e) => setUserEnabled(e.target.checked)}
              />
            </div>

            <div />
            <button className="btn primary" onClick={saveAdminUser} disabled={saveBusy}>
              {saveBusy ? "جارٍ الحفظ..." : "حفظ المستخدم"}
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
            <div>
              ملاحظة: هذه الصفحة تسمح للسوبر بإضافة <b>Admin</b> فقط.
            </div>
            <div>
              لا يمكن ربط نفس البريد الإلكتروني بأكثر من مدرسة، والبريد الإلكتروني يربط بمدرسة واحدة فقط.
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              border: "1px solid rgba(212,175,55,0.22)",
              borderRadius: 14,
              padding: 14,
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 900, color: "#d4af37" }}>
                جدول ربط المدارس مع الأدمن
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ opacity: 0.85 }}>
                  {tenantAdminBusy ? "جارٍ التحديث..." : `عدد السجلات: ${tenantAdminRows.length}`}
                </span>

                <button
                  className="btn btn-ghost"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={importBusy}
                >
                  {importBusy ? "جارٍ الاستيراد..." : "استيراد Excel"}
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => setEditReloadTick((x: number) => x + 1)}
                  disabled={tenantAdminBusy}
                >
                  تحديث الجدول
                </button>

                <button
                  className="btn primary"
                  onClick={exportTenantAdminLinksToExcel}
                  disabled={!tenantAdminRows.length}
                >
                  تصدير Excel
                </button>
              </div>
            </div>

            <input
              ref={excelInputRef}
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void importTenantAdminLinksFromExcel(file);
                }
              }}
            />

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 860,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(212,175,55,0.14)" }}>
                    <th
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "right",
                      }}
                    >
                      Tenant ID
                    </th>
                    <th
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "right",
                      }}
                    >
                      اسم المدرسة
                    </th>
                    <th
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "right",
                      }}
                    >
                      البريد الإلكتروني المرتبط
                    </th>
                    <th
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "center",
                        width: 120,
                      }}
                    >
                      إجراء
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tenantAdminRows.length ? (
                    tenantAdminRows.map((row, idx) => (
                      <tr key={`${row.tenantId}-${row.email}-${idx}`}>
                        <td style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                          {row.tenantId}
                        </td>
                        <td style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                          {row.tenantName}
                        </td>
                        <td style={{ padding: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                          {row.email}
                        </td>
                        <td
                          style={{
                            padding: 10,
                            border: "1px solid rgba(255,255,255,0.08)",
                            textAlign: "center",
                          }}
                        >
                          <button
                            className="btn danger"
                            onClick={() => deleteTenantAdminLink(row)}
                          >
                            حذف الربط
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: 14,
                          border: "1px solid rgba(255,255,255,0.08)",
                          textAlign: "center",
                          opacity: 0.8,
                        }}
                      >
                        لا توجد بيانات ربط حالياً.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, opacity: 0.78, lineHeight: 1.9 }}>
              صيغة الاستيراد المقترحة: Tenant ID ، اسم المدرسة ، البريد الإلكتروني المرتبط
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
