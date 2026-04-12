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
import { useI18n } from "../i18n/I18nProvider";
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

type Lang = "ar" | "en";

const UI = {
  ar: {
    ministry: "وزارة التعليم",
    systemTitle: "نظام إدارة الامتحانات المطور",
    ownerPanel: "لوحة مالك المنصة",
    back: "العودة",
    logout: "تسجيل خروج",
    ownerSubtitle: "مالك المنصة داخل نطاق المحافظات",
    allGovsSubtitle: "عرض جميع المحافظات",
    govManagerSubtitle: "مدير المحافظة - إدارة المدارس والمستخدمين",
    manageSchools: "إدارة المدارس",
    manageSchoolsDesc: "عرض/بحث المدارس + حذف/اختيار.",
    editSchool: "تعديل بيانات المدرسة",
    editSchoolDesc: "تعديل اسم المدرسة والشعار والولاية (داخل محافظتك).",
    addSchool: "إضافة مدرسة جديدة",
    addSchoolDesc: "إنشاء مدرسة داخل محافظتك.",
    linkAdmin: "ربط الأدمن",
    linkAdminDesc: "إضافة/ربط Admin بمدرسة محددة.",
    enterProgram: "الدخول للبرنامج",
    enterProgramDesc: "الانتقال للواجهة الرئيسية بعد اختيار المدرسة.",
    ownerRoleText: "أنت مالك المنصة، ويمكنك من هذه الشاشة مراجعة نطاق المحافظات بالكامل، كما يمكنك العودة إلى لوحة المالك لإدارة كل الصلاحيات العليا والمستخدمين والمدارس.",
    scopeRoleText: "أنت مشرف نطاق، لذلك ترى وتدير فقط المدارس والمستخدمين المرتبطين بنطاقك الإداري.",
    manageTenants: "إدارة المدارس (Tenants)",
    search: "بحث...",
    delete: "حذف",
    select: "اختيار",
    governorate: "المحافظة",
    enabled: "مفعل",
    disabled: "غير مفعل",
    noSchools: "لا توجد مدارس.",
    editSelectedSchool: "تعديل بيانات المدرسة المختارة",
    chooseSchoolFirst: "اختر مدرسة من القائمة أولاً.",
    schoolName: "اسم المدرسة",
    status: "الحالة",
    wilaya: "الولاية",
    logoUrl: "رابط الشعار",
    saving: "جاري الحفظ...",
    saveChanges: "حفظ التغييرات",
    reloadData: "إعادة تحميل البيانات",
    refresh: "تحديث",
    createTenant: "إنشاء مدرسة جديدة (Tenant)",
    active: "مفعل",
    createSchoolBtn: "إنشاء مدرسة جديدة",
    superCanCreate: "السوبر أدمن يمكنه إنشاء مدارس لأي محافظة (حسب إعدادات المدرسة).",
    fixedGovernorate: "سيتم تثبيت محافظة المدرسة تلقائيًا على:",
    unspecified: "غير محددة",
    addLinkAdmin: "إضافة/ربط Admin بالمدرسة",
    selectedSchool: "المدرسة المحددة",
    emailDoc: "البريد الإلكتروني (مفتاح الوثيقة)",
    optionalName: "الاسم (اختياري)",
    userName: "اسم المستخدم",
    saveUser: "حفظ المستخدم",
    noteAdminOnly: "ملاحظة: هذه الصفحة تسمح للسوبر بإضافة Admin فقط.",
    noteOneSchool: "لا يمكن ربط نفس البريد الإلكتروني بأكثر من مدرسة، والبريد الإلكتروني يربط بمدرسة واحدة فقط.",
    schoolAdminTable: "جدول ربط المدارس مع الأدمن",
    updating: "جارٍ التحديث...",
    recordCount: "عدد السجلات",
    importing: "جارٍ الاستيراد...",
    importExcel: "استيراد Excel",
    refreshTable: "تحديث الجدول",
    exportExcel: "تصدير Excel",
    linkedEmail: "البريد الإلكتروني المرتبط",
    action: "إجراء",
    deleteLink: "حذف الربط",
    noLinkData: "لا توجد بيانات ربط حالياً.",
    suggestedImport: "صيغة الاستيراد المقترحة: Tenant ID ، اسم المدرسة ، البريد الإلكتروني المرتبط",
    invalidEmail: "يرجى إدخال بريد صحيح.",
    createError: "تعذر إنشاء المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.",
    saveEditError: "تعذر حفظ بيانات المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.",
    deleteTenantError: "تعذر حذف المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.",
    saveUserError: "تعذر حفظ المستخدم. تأكد من الصلاحيات ثم جرّب مرة أخرى.",
    noValidImport: "لم يتم العثور على بيانات صالحة داخل الملف.",
    importSuccess: "تم استيراد بيانات الجدول بنجاح.",
    importFailed: "تعذر استيراد الملف. تأكد من أن الملف بصيغة CSV أو Excel محفوظ كنص قابل للقراءة.",
    linkDeleteConfirm: "تأكيد حذف ربط المدرسة ({school}) مع البريد ({email})؟",
    linkDeleted: "تم حذف الربط من الجدول بنجاح.",
    linkDeleteFailed: "تعذر حذف الربط. تأكد من الصلاحيات ثم جرّب مرة أخرى.",
    tenantCreated: "تم إنشاء المدرسة بنجاح ✅",
    tenantExists: "Tenant ID مستخدم بالفعل. اختر Tenant ID جديد.",
    noGov: "حساب السوبر غير مرتبط بمحافظة.",
    schoolNameRequired: "يرجى إدخال اسم المدرسة.",
    schoolSaved: "تم حفظ بيانات المدرسة بنجاح.",
    tenantDeleteConfirm: "تأكيد حذف المدرسة ({id})؟",
    tenantDeleted: "تم حذف المدرسة بنجاح.",
    schoolMissing: "المدرسة غير موجودة.",
    outsideGov: "لا يمكنك إضافة مستخدم لمدرسة خارج محافظتك.",
    emailLinked: "لا يمكن ربط نفس البريد الإلكتروني بأكثر من مدرسة. البريد الإلكتروني يربط بمدرسة واحدة فقط.",
    userSaved: "تم حفظ المستخدم بنجاح.",
    exampleBousher: "مثال: بوشر",
    exampleSchool: "مثال: أزان 12-9",
  },
  en: {
    ministry: "Ministry of Education",
    systemTitle: "Advanced Exam Management System",
    ownerPanel: "Platform Owner Panel",
    back: "Back",
    logout: "Log out",
    ownerSubtitle: "Platform owner across governorates",
    allGovsSubtitle: "Viewing all governorates",
    govManagerSubtitle: "Governorate manager - schools and users administration",
    manageSchools: "School management",
    manageSchoolsDesc: "View/search schools + delete/select.",
    editSchool: "Edit school data",
    editSchoolDesc: "Edit school name, logo, and wilaya (inside your governorate).",
    addSchool: "Add new school",
    addSchoolDesc: "Create a school inside your governorate.",
    linkAdmin: "Admin linking",
    linkAdminDesc: "Add/link Admin to a specific school.",
    enterProgram: "Enter program",
    enterProgramDesc: "Go to the main interface after selecting the school.",
    ownerRoleText: "You are the platform owner, and from this screen you can review all governorates and return to the owner panel to manage top-level permissions, users, and schools.",
    scopeRoleText: "You are a scope supervisor, so you only see and manage schools and users linked to your administrative scope.",
    manageTenants: "School Management (Tenants)",
    search: "Search...",
    delete: "Delete",
    select: "Select",
    governorate: "Governorate",
    enabled: "Enabled",
    disabled: "Disabled",
    noSchools: "No schools found.",
    editSelectedSchool: "Edit selected school data",
    chooseSchoolFirst: "Choose a school from the list first.",
    schoolName: "School name",
    status: "Status",
    wilaya: "Wilaya",
    logoUrl: "Logo URL",
    saving: "Saving...",
    saveChanges: "Save changes",
    reloadData: "Reload data",
    refresh: "Refresh",
    createTenant: "Create New School (Tenant)",
    active: "Enabled",
    createSchoolBtn: "Create new school",
    superCanCreate: "The super admin can create schools for any governorate (depending on school settings).",
    fixedGovernorate: "The school governorate will be fixed automatically to:",
    unspecified: "Unspecified",
    addLinkAdmin: "Add/Link Admin to School",
    selectedSchool: "Selected school",
    emailDoc: "Email (document key)",
    optionalName: "Name (optional)",
    userName: "User name",
    saveUser: "Save user",
    noteAdminOnly: "Note: this page allows the super admin to add Admin only.",
    noteOneSchool: "The same email cannot be linked to more than one school, and each email can only be linked to one school.",
    schoolAdminTable: "School-admin linking table",
    updating: "Updating...",
    recordCount: "Record count",
    importing: "Importing...",
    importExcel: "Import Excel",
    refreshTable: "Refresh table",
    exportExcel: "Export Excel",
    linkedEmail: "Linked email",
    action: "Action",
    deleteLink: "Delete link",
    noLinkData: "No linking data currently available.",
    suggestedImport: "Suggested import format: Tenant ID, School name, Linked email",
    invalidEmail: "Please enter a valid email.",
    createError: "Unable to create the school. Check permissions and try again.",
    saveEditError: "Unable to save school data. Check permissions and try again.",
    deleteTenantError: "Unable to delete the school. Check permissions and try again.",
    saveUserError: "Unable to save the user. Check permissions and try again.",
    noValidImport: "No valid data was found in the file.",
    importSuccess: "Table data was imported successfully.",
    importFailed: "Unable to import the file. Make sure the file is CSV or Excel saved as readable text.",
    linkDeleteConfirm: "Confirm deleting the school link ({school}) with email ({email})?",
    linkDeleted: "The link was deleted successfully.",
    linkDeleteFailed: "Unable to delete the link. Check permissions and try again.",
    tenantCreated: "School created successfully ✅",
    tenantExists: "Tenant ID is already used. Choose a new Tenant ID.",
    noGov: "The super account is not linked to a governorate.",
    schoolNameRequired: "Please enter the school name.",
    schoolSaved: "School data saved successfully.",
    tenantDeleteConfirm: "Confirm deleting the school ({id})?",
    tenantDeleted: "School deleted successfully.",
    schoolMissing: "The school does not exist.",
    outsideGov: "You cannot add a user to a school outside your governorate.",
    emailLinked: "The same email cannot be linked to more than one school. Each email can only be linked to one school.",
    userSaved: "User saved successfully.",
    exampleBousher: "Example: Bousher",
    exampleSchool: "Example: Azzan 12-9",
  },
} as const;

function translateRoleLabel(label: string, lang: Lang): string {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "مشرف نطاق": { ar: "مشرف نطاق", en: "Domain Supervisor" },
    "مدير جهة": { ar: "مدير جهة", en: "Tenant Admin" },
    "مدير": { ar: "مدير", en: "Manager" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
    "مستخدم": { ar: "مستخدم", en: "User" },
  };
  return map[label]?.[lang] || label;
}


type TenantAdminLinkRow = {
  tenantId: string;
  tenantName: string;
  email: string;
};

export default function SuperSystem() {
  const navigate = useNavigate();
  const { lang, setLang } = useI18n();
  const isAr = lang === "ar";
  const ui = UI[(lang as Lang) || "ar"];
  const auth = useAuth() as any;
  const { user, allow, logout } = auth;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const roleBadgeBase = resolveRoleBadgeStyle(authzSnapshot);
  const roleBadge = { ...roleBadgeBase, label: translateRoleLabel(roleBadgeBase.label, lang as Lang) };
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
              <th>{ui.schoolName}</th>
              <th>{ui.linkedEmail}</th>
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
    a.download = isAr ? "tenant-admin-links.xls" : "tenant-admin-links.xls";
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
    const tenantNameIndex = header.findIndex((h) => h.includes("{ui.schoolName}") || h.includes("school"));
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
        alert(ui.noValidImport);
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
      alert(ui.importSuccess);
    } catch (e) {
      console.error(e);
      alert(ui.importFailed);
    } finally {
      setImportBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const deleteTenantAdminLink = async (row: TenantAdminLinkRow) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) return;

    const ok = confirm(ui.linkDeleteConfirm.replace("{school}", row.tenantName || row.tenantId).replace("{email}", email));
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
      alert(ui.linkDeleted);
    } catch (e) {
      console.error(e);
      alert(ui.linkDeleteFailed);
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
      alert(ui.tenantCreated);
    } catch (e: any) {
      console.error(e);
      if (String(e?.message || "") === "TENANT_EXISTS") {
        alert(ui.tenantExists);
      } else if (String(e?.message || "") === "MISSING_GOVERNORATE") {
        alert(ui.noGov);
      } else {
        alert(
          getActionErrorMessage(
            e,
            ui.createError
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
      alert(ui.schoolNameRequired);
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
      alert(ui.schoolSaved);
    } catch (e: any) {
      console.error(e);
      alert(
        getActionErrorMessage(
          e,
          ui.saveEditError
        )
      );
    } finally {
      setEditBusy(false);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    const id = String(tenantId || "").trim();
    if (!id) return;
    if (!confirm(ui.tenantDeleteConfirm.replace("{id}", id))) return;

    try {
      await archiveAndDeleteTenant({
        tenantId: id,
        deletedBy: String(user?.email || ""),
      });
      setTenants((prev) => prev.filter((t) => t.id !== id));
      if (selectedTenantId === id) setSelectedTenantId("");
      setEditReloadTick((x: number) => x + 1);
      alert(ui.tenantDeleted);
    } catch (e) {
      console.error(e);
      alert(
        getActionErrorMessage(
          e,
          ui.deleteTenantError
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
      alert(ui.schoolMissing);
      return;
    }

    if (!canSeeAllGovs && String(tenant.governorate || "") !== myGov) {
      alert(ui.outsideGov);
      return;
    }

    setSaveBusy(true);
    try {
      const alreadyLinked = await isEmailAlreadyLinkedToAnotherSchool(userEmail, tenantId);
      if (alreadyLinked) {
        alert(ui.emailLinked);
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
      alert(ui.userSaved);
    } catch (e: any) {
      console.error(e);
      alert(
        String(e?.message || "") === "INVALID_EMAIL"
          ? ui.invalidEmail
          : getActionErrorMessage(
              e,
              ui.saveUserError
            )
      );
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="super-system-page" dir={isAr ? "rtl" : "ltr"}>
      <div className="super-header">
        <div className="super-header-right super-brand">
          <img
            className="super-brand-logo"
            src={MINISTRY_LOGO_URL}
            alt={ui.ministry}
          />
          <div className="super-brand-text">
            <div className="super-brand-ministry">{ui.ministry}</div>
            <div className="super-brand-gov">{myGov || ""}</div>
          </div>
        </div>

        <div className="super-header-center">
          <div className="super-program-title">{ui.systemTitle}</div>
          <div className="super-subtitle">
            {isOwner
              ? ui.ownerSubtitle
              : canSeeAllGovs
              ? ui.allGovsSubtitle
              : ui.govManagerSubtitle}
          </div>
        </div>

        <div className="super-header-left">
          <button className="super-btn" onClick={() => setLang(isAr ? "en" : "ar")}>
            {isAr ? "English" : "العربية"}
          </button>
          {isOwner ? (
            <button className="super-btn" onClick={() => navigate("/system")}>
              {ui.ownerPanel}
            </button>
          ) : null}
          <button className="super-btn" onClick={() => navigate("/")}>
            {ui.back}
          </button>
          <button className="super-btn danger" onClick={() => logout()}>
            {ui.logout}
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
          <div className="super-card-title">{ui.manageSchools}</div>
          <div className="super-card-desc">{ui.manageSchoolsDesc}</div>
        </button>

        <button
          className="super-card"
          onClick={() =>
            document.getElementById("section-edit")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <div className="super-card-title">{ui.editSchool}</div>
          <div className="super-card-desc">
            {ui.editSchoolDesc}
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
          <div className="super-card-title">{ui.addSchool}</div>
          <div className="super-card-desc">{ui.addSchoolDesc}</div>
        </button>

        <button
          className="super-card"
          onClick={() =>
            document.getElementById("section-admin")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          <div className="super-card-title">{ui.linkAdmin}</div>
          <div className="super-card-desc">{ui.linkAdminDesc}</div>
        </button>

        <button className="super-card" onClick={() => navigate("/")}>
          <div className="super-card-title">{ui.enterProgram}</div>
          <div className="super-card-desc">
            {ui.enterProgramDesc}
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
            ? "أنت مالك المنصة، ويمكنك من هذه الشاشة مراجعة نطاق المحافظات بالكامل، كما يمكنك {ui.back} إلى لوحة المالك لإدارة كل الصلاحيات العليا والمستخدمين والمدارس."
            : "أنت مشرف نطاق، لذلك ترى وتدير فقط المدارس والمستخدمين المرتبطين بنطاقك الإداري."}
        </div>
      </div>

      <div className="super-grid">
        <div className="super-panel" id="section-tenants">
          <div className="super-panel-title">{ui.manageTenants}</div>
          <div style={{ marginBottom: 10 }}>
            <input
              className="input"
              placeholder={ui.search}
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
                <button className="icon-btn" title={ui.delete} onClick={() => deleteTenant(t.id)}>
                  🗑️
                </button>
                <button
                  className="icon-btn"
                  title={ui.select}
                  onClick={() => setSelectedTenantId(t.id)}
                >
                  📁
                </button>
                <div className="tenant-meta" onClick={() => setSelectedTenantId(t.id)}>
                  <div className="tenant-name">{t.name || t.id}</div>
                  <div className="tenant-id">{t.id}</div>
                  <div className="tenant-id" style={{ opacity: 0.8 }}>
                    {t.governorate ? `${ui.governorate}: ${t.governorate}` : ""}
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
                  <span style={{ opacity: 0.9 }}>{t.enabled ? ui.enabled : ui.disabled}</span>
                  <input type="checkbox" checked={t.enabled !== false} readOnly />
                </div>
              </div>
            ))}
            {!visibleTenants.length ? (
              <div style={{ padding: 12, opacity: 0.8 }}>{ui.noSchools}</div>
            ) : null}
          </div>
        </div>

        <div className="super-panel" id="section-edit">
          <div className="super-panel-title">{ui.editSelectedSchool}</div>
          {!selectedTenantId ? (
            <div style={{ padding: 12, opacity: 0.85 }}>{ui.chooseSchoolFirst}</div>
          ) : (
            <div className="form-grid">
              <label className="label">Tenant ID</label>
              <input className="input" value={selectedTenantId} readOnly />

              <label className="label">{ui.schoolName}</label>
              <input
                className="input"
                value={editTenantName}
                onChange={(e) => setEditTenantName(e.target.value)}
              />

              <label className="label">{ui.status}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={editTenantEnabled !== false}
                  onChange={(e) => setEditTenantEnabled(e.target.checked)}
                />
                <span style={{ opacity: 0.9 }}>
                  {editTenantEnabled ? ui.enabled : ui.disabled}
                </span>
              </div>

              <label className="label">{ui.wilaya}</label>
              <input
                className="input"
                value={editWilayatAr}
                onChange={(e) => setEditWilayatAr(e.target.value)}
                placeholder={ui.exampleBousher}
              />

              <label className="label">{ui.logoUrl}</label>
              <input
                className="input"
                value={editLogoUrl}
                onChange={(e) => setEditLogoUrl(e.target.value)}
                placeholder={MINISTRY_LOGO_URL}
              />

              <div />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn" disabled={editBusy} onClick={saveSelectedTenant}>
                  {editBusy ? ui.saving : ui.saveChanges}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={editBusy}
                  onClick={() => setEditReloadTick((x: number) => x + 1)}
                  title={ui.reloadData}
                >
                  تحديث
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="super-panel" id="section-create">
          <div className="super-panel-title">{ui.createTenant}</div>
          <div className="form-grid">
            <label className="label">{ui.schoolName}</label>
            <input
              className="input"
              value={newTenantName}
              onChange={(e) => setNewTenantName(e.target.value)}
              placeholder={ui.exampleSchool}
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
              <span className="label">{ui.active}</span>
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
              <div>{ui.superCanCreate}</div>
            ) : (
              <div>
                {ui.fixedGovernorate} <b>{myGov || ui.unspecified}</b>
              </div>
            )}
          </div>
        </div>

        <div className="super-panel" id="section-admin">
          <div className="super-panel-title">{ui.addLinkAdmin}</div>

          <div style={{ marginBottom: 10, opacity: 0.85 }}>
            {ui.selectedSchool}: <b>{selectedTenant?.name || selectedTenantId || "—"}</b>
          </div>

          <div className="form-grid">
            <label className="label">{ui.emailDoc}</label>
            <input
              className="input"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="name@example.com"
            />

            <label className="label">{ui.optionalName}</label>
            <input
              className="input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={ui.userName}
            />

            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="label">{ui.active}</span>
              <input
                type="checkbox"
                checked={userEnabled}
                onChange={(e) => setUserEnabled(e.target.checked)}
              />
            </div>

            <div />
            <button className="btn primary" onClick={saveAdminUser} disabled={saveBusy}>
              {saveBusy ? ui.saving : ui.saveUser}
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.9 }}>
            <div>
              {ui.noteAdminOnly}
            </div>
            <div>
              {ui.noteOneSchool}
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
                {ui.schoolAdminTable}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ opacity: 0.85 }}>
                  {tenantAdminBusy ? ui.updating : `${ui.recordCount}: ${tenantAdminRows.length}`}
                </span>

                <button
                  className="btn btn-ghost"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={importBusy}
                >
                  {importBusy ? ui.importing : ui.importExcel}
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => setEditReloadTick((x: number) => x + 1)}
                  disabled={tenantAdminBusy}
                >
                  {ui.refreshTable}
                </button>

                <button
                  className="btn primary"
                  onClick={exportTenantAdminLinksToExcel}
                  disabled={!tenantAdminRows.length}
                >
                  {ui.exportExcel}
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
                      {ui.schoolName}
                    </th>
                    <th
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "right",
                      }}
                    >
                      {ui.linkedEmail}
                    </th>
                    <th
                      style={{
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "center",
                        width: 120,
                      }}
                    >
                      {ui.action}
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
                            {ui.deleteLink}
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
                        {ui.noLinkData}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, opacity: 0.78, lineHeight: 1.9 }}>
              صيغة الاستيراد المقترحة: Tenant ID ، {ui.schoolName} ، {ui.linkedEmail}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
