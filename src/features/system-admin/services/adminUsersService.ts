import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { callFn } from "../../../services/functionsClient";
import {
  isStrictCloudRuntimeFunction,
  toCloudRuntimeActionError,
} from "../../../services/functionsRuntimePolicy";
import { logActivity } from "../../../services/activityLog.service";
import { writeSecurityAudit } from "../../../services/securityAudit";
import {
  isSameDirectorate,
  MINISTRY_SCOPE,
  normalizeText,
  PRIMARY_SUPER_ADMIN_EMAIL,
} from "../../../constants/directorates";
import { canManageAdminSystemRole } from "../../authz";
import type { AllowUser } from "../types";
import {
  normalizeRoleClient,
  resolveTenantGovernorate,
  stripUndefined,
} from "./adminSystemShared";

const USE_FUNCTIONS = !Boolean((import.meta as any).env?.DEV);

function isSchoolAdminRole(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "tenant_admin" || r === "admin";
}

function isSchoolScopedRole(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "tenant_admin" || r === "admin" || r === "user";
}

function sanitizeNonSchoolRolePayload(input: {
  roleNorm: string;
  tenantId?: string;
  schoolName?: string;
  tenantName?: string;
  tenantGovernorate?: string;
}) {
  if (isSchoolScopedRole(input.roleNorm)) {
    return {
      tenantId: String(input.tenantId || "").trim(),
      schoolName: String(input.schoolName || "").trim(),
      tenantName: String(input.tenantName || "").trim(),
      tenantGovernorate: String(input.tenantGovernorate || "").trim(),
    };
  }

  return {
    tenantId: "",
    schoolName: "",
    tenantName: "",
    tenantGovernorate: "",
  };
}

async function resolveTenantSchoolName(tenantId: string) {
  const cfgSnap = await getDoc(doc(db, "tenants", tenantId, "meta", "config"));
  if (cfgSnap.exists()) {
    const data = cfgSnap.data() as any;
    const v = String(data?.schoolNameAr || "").trim();
    if (v) return v;
  }

  const tSnap = await getDoc(doc(db, "tenants", tenantId));
  if (tSnap.exists()) {
    const data = tSnap.data() as any;
    const v = String(data?.name || "").trim();
    if (v) return v;
  }

  return tenantId;
}

async function assertTenantCanChangeAdminBinding(tenantId: string) {
  const tSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tSnap.exists()) throw new Error("هذا الـ Tenant غير موجود. أنشئ المدرسة أولاً.");
  const data = tSnap.data() as any;
  if (data?.enabled === false) {
    throw new Error("المدرسة غير مفعلة. فعّل المدرسة أولاً قبل تعديل أو نقل أو فك ربط الأدمن.");
  }
  return data;
}

async function upsertSchoolAdminBinding(input: {
  email: string;
  tenantId: string;
  enabled: boolean;
  roleNorm: "tenant_admin";
  governorateFinal?: string;
  userName?: string;
  schoolName?: string;
  actorEmail?: string;
  forceTransfer?: boolean;
}) {
  const {
    email,
    tenantId,
    enabled,
    roleNorm,
    governorateFinal,
    userName,
    schoolName,
    actorEmail,
    forceTransfer,
  } = input;

  const effectiveSchoolName = String(schoolName || "").trim() || (await resolveTenantSchoolName(tenantId));
  const linkRef = doc(db, "allowlist", email);
  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

  await runTransaction(db, async (tx) => {
    const [linkSnap, tenantLinkSnap, tenantSnap] = await Promise.all([
      tx.get(linkRef),
      tx.get(tenantLinkRef),
      tx.get(doc(db, "tenants", tenantId)),
    ]);

    if (!tenantSnap.exists()) {
      throw new Error("هذا الـ Tenant غير موجود. أنشئ المدرسة أولاً.");
    }

    const tenantData = tenantSnap.data() as any;
    if (tenantData?.enabled === false) {
      throw new Error("المدرسة غير مفعلة. فعّل المدرسة أولاً قبل تعديل أو نقل أو فك ربط الأدمن.");
    }

    const existingEmailData = linkSnap.exists()
      ? (linkSnap.data() as Record<string, unknown>)
      : {};
    const existingEmailRole = String(existingEmailData?.role || "").trim().toLowerCase();
    const existingEmailTenantId = String(existingEmailData?.tenantId || "").trim();

    if (
      linkSnap.exists() &&
      isSchoolAdminRole(existingEmailRole) &&
      existingEmailTenantId &&
      existingEmailTenantId !== tenantId
    ) {
      const oldTenantRef = doc(db, "tenants", existingEmailTenantId);
      const oldTenantSnap = await tx.get(oldTenantRef);
      const oldTenantData = oldTenantSnap.exists() ? (oldTenantSnap.data() as any) : {};
      if (oldTenantData?.enabled === false) {
        throw new Error("هذا البريد مرتبط بمدرسة غير مفعلة. فعّل المدرسة الحالية أولاً قبل نقله.");
      }
      if (!forceTransfer) {
        throw new Error("EMAIL_ALREADY_LINKED_TO_ANOTHER_TENANT");
      }
      tx.delete(doc(db, "tenantAdminLinks", existingEmailTenantId));
    }

    const existingTenantLinkData = tenantLinkSnap.exists()
      ? (tenantLinkSnap.data() as Record<string, unknown>)
      : {};
    const existingTenantEmail = String(existingTenantLinkData?.email || "").trim().toLowerCase();

    if (tenantLinkSnap.exists() && existingTenantEmail && existingTenantEmail !== email) {
      throw new Error("TENANT_ALREADY_LINKED_TO_ANOTHER_EMAIL");
    }

    const payload = stripUndefined({
      email,
      enabled: !!enabled,
      role: roleNorm,
      tenantId,
      governorate: governorateFinal,
      schoolName: effectiveSchoolName,
      tenantName: effectiveSchoolName,
      tenantGovernorate: governorateFinal,
      userName: String(userName || "").trim() || effectiveSchoolName,
      name: String(userName || "").trim() || effectiveSchoolName,
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail || "",
    });

    tx.set(linkRef, payload, { merge: true });
    tx.set(
      tenantLinkRef,
      {
        tenantId,
        email,
        schoolName: effectiveSchoolName,
        governorate: governorateFinal,
        updatedAt: serverTimestamp(),
        updatedBy: actorEmail || "",
      },
      { merge: true },
    );
  });
}

export async function buildGovernorateForUserRole(
  roleNorm: AllowUser["role"] | "tenant_admin" | "ministry_super",
  tenantId: string,
  governorateInput: string,
): Promise<string | undefined> {
  if (roleNorm === "super") return normalizeText(String(governorateInput ?? "")) || undefined;
  if (roleNorm === "ministry_super") return normalizeText(String(MINISTRY_SCOPE)) || undefined;
  if (roleNorm === "tenant_admin" || String(roleNorm) === "admin") {
    return normalizeText(await resolveTenantGovernorate(tenantId)) || undefined;
  }
  return undefined;
}

export async function createAllowUserAction(args: any) {
  const {
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
  } = args;

  const email = String(newUserEmail || "").trim().toLowerCase();
  const tenantId = String(newUserTenantId || "").trim();
  const tSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tSnap.exists()) throw new Error("هذا الـ Tenant غير موجود. أنشئ المدرسة أولاً.");

  const roleNorm = normalizeRoleClient(newUserRole, newUserGovernorate);
  const emailLower = email.toLowerCase().trim();
  const isProtectedOwnerEmail = emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();

  if (isSuper && roleNorm !== "tenant_admin" && String(roleNorm) !== "admin") {
    throw new Error("سوبر المحافظات لا يستطيع إنشاء إلا (أدمن المدرسة) فقط.");
  }
  if (isProtectedOwnerEmail) throw new Error("لا يمكن تعديل/حذف/تعطيل مالك المنصة الرئيسي.");
  if (!canManageAdminSystemRole(authzSnapshot, roleNorm)) {
    throw new Error("ليست لديك صلاحية لإنشاء هذا النوع من المستخدمين.");
  }

  const superAdminCount = users.filter((u: any) => {
    const r = normalizeRoleClient((u as any).role, (u as any).governorate);
    const em = String((u as any).email ?? "").toLowerCase().trim();
    return r === "super_admin" || em === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
  }).length;

  const superCount = users.filter(
    (u: any) => normalizeRoleClient((u as any).role, (u as any).governorate) === "super",
  ).length;

  if (
    roleNorm === "super_admin" &&
    emailLower !== PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() &&
    superAdminCount >= 2
  ) {
    throw new Error("الحد الأقصى للسوبر أدمن هو 2 فقط.");
  }

  if (roleNorm === "super") {
    if (superCount >= 12) throw new Error("الحد الأقصى للسوبر (المديرية) هو 12 فقط.");
    if (!normalizeText(String(newUserGovernorate ?? ""))) {
      throw new Error("يجب اختيار المديرية للسوبر.");
    }
  }

  if (isSuper) {
    const myG = normalizeText(String((profile as any)?.governorate ?? ""));
    const tenantGov = normalizeText(
      String((selectedTenantConfig as any)?.governorate ?? (tSnap.data() as any)?.governorate ?? ""),
    );
    if (myG && myG !== normalizeText(MINISTRY_SCOPE) && tenantGov && !isSameDirectorate(tenantGov, myG)) {
      throw new Error("لا يمكنك إضافة أدمن مدرسة خارج نطاق محافظتك.");
    }
  }

  const governorateFinal = await buildGovernorateForUserRole(roleNorm, tenantId, newUserGovernorate);
  const roleScope = sanitizeNonSchoolRolePayload({
    roleNorm,
    tenantId,
    schoolName: String(newUserSchoolName || "").trim(),
    tenantName: String(newUserSchoolName || "").trim(),
    tenantGovernorate: governorateFinal,
  });

  if (roleNorm === "tenant_admin" || String(roleNorm) === "admin") {
    await assertTenantCanChangeAdminBinding(tenantId);

    await upsertSchoolAdminBinding({
      email,
      tenantId,
      enabled: !!newUserEnabled,
      roleNorm: "tenant_admin",
      governorateFinal,
      userName: String(newUserName || "").trim(),
      schoolName: String(newUserSchoolName || "").trim(),
      actorEmail: user.email || "",
      forceTransfer: false,
    });
  } else {
    try {
      if (USE_FUNCTIONS) {
        await callFn<any, any>("adminUpsertAllowlist")({
          email,
          enabled: !!newUserEnabled,
          role: roleNorm,
          tenantId: roleScope.tenantId,
          governorate: governorateFinal,
          name: String(newUserName || "").trim(),
          schoolName: roleScope.schoolName,
        });
      } else {
        throw new Error("skip");
      }
    } catch (error) {
      if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminUpsertAllowlist")) {
        throw toCloudRuntimeActionError(error, "adminUpsertAllowlist", "إنشاء/تحديث المستخدم");
      }
      await setDoc(
        doc(db, "allowlist", email),
        stripUndefined({
          email,
          enabled: !!newUserEnabled,
          role: roleNorm,
          tenantId: roleScope.tenantId,
          governorate: governorateFinal,
          name: String(newUserName || "").trim(),
          schoolName: roleScope.schoolName,
          createdAt: serverTimestamp(),
          createdBy: user.email || "",
          updatedAt: serverTimestamp(),
          updatedBy: user.email || "",
        }),
        { merge: true },
      );
    }
  }

  await writeSecurityAudit({
    type: "ALLOWLIST_CREATE",
    tenantId,
    actorUid: user.uid,
    actorEmail: user.email || "",
    targetEmail: email,
    details: {
      role: roleNorm,
      governorate: governorateFinal,
      enabled: !!newUserEnabled,
      name: String(newUserName || "").trim(),
      schoolName: String(newUserSchoolName || "").trim(),
    },
  });

  await logActivity(tenantId, {
    actorUid: user.uid,
    actorEmail: user.email || "",
    action: "ALLOWLIST_CREATED",
    entity: "allowlist",
    entityId: email,
    meta: {
      role: roleNorm,
      governorate: governorateFinal,
      enabled: !!newUserEnabled,
      name: String(newUserName || "").trim(),
      schoolName: String(newUserSchoolName || "").trim(),
    },
  });
}

export async function updateAllowUserAction(args: any) {
  const { user, users, authzSnapshot, isSuper, resolveTenantGovernorate, email, patch, forceTransfer } = args;
  const current = users.find((u: any) => u.email.toLowerCase() === String(email).toLowerCase());

  const merged: AllowUser = {
    email: String(email).toLowerCase(),
    tenantId: current?.tenantId || "",
    enabled: typeof current?.enabled === "boolean" ? current.enabled : true,
    role: (current?.role as any) || "user",
    name: current?.name || "",
    schoolName: (current as any)?.schoolName || "",
    ...(current as any),
    ...(patch as any),
  };

  const roleNorm = normalizeRoleClient(merged.role, (merged as any).governorate);
  const emailLower = String(merged.email || "").toLowerCase().trim();
  if (emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error("لا يمكن تعديل/حذف/تعطيل مالك المنصة الرئيسي.");
  }
  if (!canManageAdminSystemRole(authzSnapshot, roleNorm)) {
    throw new Error("ليست لديك صلاحية لتعديل هذا النوع من المستخدمين.");
  }
  if (isSuper && roleNorm !== "tenant_admin" && String(roleNorm) !== "admin") {
    throw new Error("سوبر المحافظات لا يستطيع تعديل إلا (أدمن المدرسة) فقط.");
  }

  let governorateFinal: string | undefined;
  if (roleNorm === "super") {
    governorateFinal = normalizeText(String((merged as any).governorate ?? "")) || undefined;
    if (!governorateFinal) throw new Error("يجب تحديد المحافظة لسوبر المحافظات.");
    if (governorateFinal === normalizeText(MINISTRY_SCOPE)) {
      throw new Error("سوبر المحافظات لا يمكن أن يكون على نطاق الوزارة.");
    }
  } else if (roleNorm === "ministry_super") {
    governorateFinal = normalizeText(String(MINISTRY_SCOPE)) || undefined;
  } else if (roleNorm === "tenant_admin" || String(roleNorm) === "admin") {
    governorateFinal =
      normalizeText(await resolveTenantGovernorate(String(merged.tenantId || ""))) || undefined;
  }

  const roleScope = sanitizeNonSchoolRolePayload({
    roleNorm,
    tenantId: String(merged.tenantId || "").trim(),
    schoolName: String((merged as any).schoolName || "").trim(),
    tenantName: String((merged as any).tenantName || "").trim(),
    tenantGovernorate: governorateFinal,
  });

  if (roleNorm === "tenant_admin" || String(roleNorm) === "admin") {
    const oldTenantId = String((current as any)?.tenantId || "").trim();
    const newTenantId = String(merged.tenantId || "").trim();

    if (oldTenantId && oldTenantId !== newTenantId) {
      await assertTenantCanChangeAdminBinding(oldTenantId);
    }
    await assertTenantCanChangeAdminBinding(newTenantId);

    await upsertSchoolAdminBinding({
      email: merged.email,
      tenantId: newTenantId,
      enabled: !!merged.enabled,
      roleNorm: "tenant_admin",
      governorateFinal,
      userName: String((merged as any).name || "").trim(),
      schoolName: String((merged as any).schoolName || "").trim(),
      actorEmail: user.email || "",
    });

    if (oldTenantId && oldTenantId !== newTenantId) {
      const oldTenantLinkRef = doc(db, "tenantAdminLinks", oldTenantId);
      const oldTenantLinkSnap = await getDoc(oldTenantLinkRef);
      if (oldTenantLinkSnap.exists()) {
        const oldTenantLinkData = oldTenantLinkSnap.data() as any;
        const oldLinkedEmail = String(oldTenantLinkData?.email || "").trim().toLowerCase();
        if (oldLinkedEmail === merged.email) {
          await deleteDoc(oldTenantLinkRef);
        }
      }
    }
    return;
  }

  if (isSchoolAdminRole(String((current as any)?.role || ""))) {
    const oldTenantId = String((current as any)?.tenantId || "").trim();
    if (oldTenantId) {
      const oldTenantLinkRef = doc(db, "tenantAdminLinks", oldTenantId);
      const oldTenantLinkSnap = await getDoc(oldTenantLinkRef);
      if (oldTenantLinkSnap.exists()) {
        const oldTenantLinkData = oldTenantLinkSnap.data() as any;
        const oldLinkedEmail = String(oldTenantLinkData?.email || "").trim().toLowerCase();
        if (oldLinkedEmail === merged.email) {
          await deleteDoc(oldTenantLinkRef);
        }
      }
    }
  }

  try {
    if (USE_FUNCTIONS) {
      await callFn<any, any>("adminUpsertAllowlist")({
        email: merged.email,
        tenantId: roleScope.tenantId,
        governorate: governorateFinal,
        enabled: !!merged.enabled,
        role: roleNorm,
        name: (merged.name || "").trim(),
        schoolName: roleScope.schoolName,
      });
    } else {
      throw new Error("skip");
    }
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminUpsertAllowlist")) {
      throw toCloudRuntimeActionError(error, "adminUpsertAllowlist", "تعديل المستخدم");
    }
    await setDoc(
      doc(db, "allowlist", merged.email),
      stripUndefined({
        email: merged.email,
        tenantId: roleScope.tenantId,
        governorate: governorateFinal,
        enabled: !!merged.enabled,
        role: roleNorm,
        name: (merged.name || "").trim(),
        schoolName: roleScope.schoolName,
        tenantName: roleScope.tenantName || undefined,
        tenantGovernorate: roleScope.tenantGovernorate || undefined,
        updatedAt: serverTimestamp(),
        updatedBy: user.email || "",
      }),
      { merge: true },
    );
  }
}

export async function removeAllowUserAction(args: any) {
  const { user, users, authzSnapshot, email } = args;
  const item = users.find(
    (u: any) => String(u.email).toLowerCase() === String(email).toLowerCase(),
  );
  const roleNorm = normalizeRoleClient((item as any)?.role, (item as any)?.governorate);
  const emailLower = String(email || "").toLowerCase().trim();

  if (emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error("لا يمكن حذف مالك المنصة الرئيسي.");
  }
  if (!canManageAdminSystemRole(authzSnapshot, roleNorm)) {
    throw new Error("ليست لديك صلاحية لحذف هذا النوع من المستخدمين.");
  }

  if (isSchoolAdminRole(roleNorm)) {
    const tenantId = String(item?.tenantId || "").trim();
    if (tenantId) {
      await assertTenantCanChangeAdminBinding(tenantId);
      const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);
      const tenantLinkSnap = await getDoc(tenantLinkRef);
      if (tenantLinkSnap.exists()) {
        const tenantLinkData = tenantLinkSnap.data() as any;
        const linkedEmail = String(tenantLinkData?.email || "").trim().toLowerCase();
        if (linkedEmail === emailLower) {
          await deleteDoc(tenantLinkRef);
        }
      }
    }
  }

  try {
    if (USE_FUNCTIONS) await callFn<any, any>("adminDeleteAllowlist")({ email: emailLower });
    else throw new Error("skip");
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminDeleteAllowlist")) {
      throw toCloudRuntimeActionError(error, "adminDeleteAllowlist", "حذف المستخدم");
    }
    await deleteDoc(doc(db, "allowlist", emailLower));
  }

  if (item?.tenantId) {
    await writeSecurityAudit({
      type: "ALLOWLIST_DELETE",
      tenantId: item.tenantId,
      actorUid: user.uid,
      actorEmail: user.email || "",
      targetEmail: emailLower,
      details: { role: roleNorm },
    });
  }
}

export async function loadOwnerForTenantAction(tid: string) {
  const snap = await getDoc(doc(db, "tenants", tid, "meta", "owner"));
  return snap.exists() ? snap.data() : null;
}

export async function inviteSingleOwnerAction(args: any) {
  const { user, ownerTenantId, ownerEmail } = args;
  const tid = String(ownerTenantId || "").trim();
  const em = String(ownerEmail || "").trim().toLowerCase();
  if (!tid || !em.includes("@")) throw new Error("أدخل tenantId صحيح وبريد صحيح.");

  await assertTenantCanChangeAdminBinding(tid);

  const governorate = normalizeText(await resolveTenantGovernorate(tid)) || undefined;
  const schoolName = await resolveTenantSchoolName(tid);

  await upsertSchoolAdminBinding({
    email: em,
    tenantId: tid,
    enabled: true,
    roleNorm: "tenant_admin",
    governorateFinal: governorate,
    userName: schoolName,
    schoolName,
    actorEmail: user.email || "",
  });

  await setDoc(
    doc(db, "allowlist", em),
    {
      email: em,
      enabled: true,
      role: "tenant_admin",
      tenantId: tid,
      governorate,
      schoolName,
      tenantName: schoolName,
      tenantGovernorate: governorate,
      userName: schoolName,
      name: schoolName,
      createdAt: serverTimestamp(),
      createdBy: user.email || "",
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    },
    { merge: true },
  );
}
