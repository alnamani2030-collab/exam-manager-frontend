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

function isSchoolAdminRole(role: unknown) {
  const value = String(role || "").trim().toLowerCase();
  return value === "tenant_admin" || value === "admin";
}

async function getTenantState(tenantId: string) {
  const tenantRef = doc(db, "tenants", tenantId);
  const cfgRef = doc(db, "tenants", tenantId, "meta", "config");
  const [tenantSnap, cfgSnap] = await Promise.all([getDoc(tenantRef), getDoc(cfgRef)]);

  if (!tenantSnap.exists()) {
    throw new Error("هذا الـ Tenant غير موجود. أنشئ المدرسة أولاً.");
  }

  const tenantData = (tenantSnap.data() as Record<string, unknown>) || {};
  const cfgData = cfgSnap.exists()
    ? ((cfgSnap.data() as Record<string, unknown>) || {})
    : {};

  return {
    enabled: tenantData?.enabled !== false,
    schoolName: String(
      tenantData?.name || cfgData?.schoolNameAr || tenantId,
    ).trim(),
    governorate: normalizeText(
      String(cfgData?.governorate || cfgData?.regionAr || tenantData?.governorate || ""),
    ) || "",
  };
}

export async function buildGovernorateForUserRole(
  roleNorm: AllowUser["role"] | "tenant_admin" | "ministry_super",
  tenantId: string,
  governorateInput: string,
): Promise<string | undefined> {
  if (roleNorm === "super") {
    return normalizeText(String(governorateInput ?? "")) || undefined;
  }
  if (roleNorm === "ministry_super") {
    return normalizeText(String(MINISTRY_SCOPE)) || undefined;
  }
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
  const tenantState = await getTenantState(tenantId);

  const roleNorm = normalizeRoleClient(newUserRole, newUserGovernorate);
  const emailLower = email.toLowerCase().trim();
  const isProtectedOwnerEmail =
    emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();

  if (isSuper && roleNorm !== "tenant_admin" && String(roleNorm) !== "admin") {
    throw new Error("سوبر المحافظات لا يستطيع إنشاء إلا (أدمن المدرسة) فقط.");
  }
  if (isProtectedOwnerEmail) {
    throw new Error("لا يمكن تعديل/حذف/تعطيل مالك المنصة الرئيسي.");
  }
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
      String(
        (selectedTenantConfig as any)?.governorate ??
          (selectedTenantConfig as any)?.regionAr ??
          tenantState.governorate ??
          "",
      ),
    );
    if (
      myG &&
      myG !== normalizeText(MINISTRY_SCOPE) &&
      tenantGov &&
      !isSameDirectorate(tenantGov, myG)
    ) {
      throw new Error("لا يمكنك إضافة أدمن مدرسة خارج نطاق محافظتك.");
    }
  }

  if (isSchoolAdminRole(roleNorm) && !tenantState.enabled) {
    throw new Error(
      "هذه المدرسة غير مفعلة. يجب تفعيل المدرسة أولاً قبل ربط الأدمن بها أو استبداله.",
    );
  }

  const governorateFinal = await buildGovernorateForUserRole(
    roleNorm,
    tenantId,
    newUserGovernorate,
  );
  const schoolName =
    String(newUserSchoolName || "").trim() || tenantState.schoolName || tenantId;
  const displayName =
    String(newUserName || "").trim() || schoolName || tenantId;

  try {
    if (USE_FUNCTIONS) {
      await callFn<any, any>("adminUpsertAllowlist")({
        email,
        enabled: isSchoolAdminRole(roleNorm) ? tenantState.enabled : !!newUserEnabled,
        role: roleNorm,
        tenantId,
        governorate: governorateFinal,
        name: displayName,
        userName: displayName,
        schoolName,
        tenantName: schoolName,
        tenantGovernorate: governorateFinal,
      });
    } else {
      throw new Error("skip");
    }
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminUpsertAllowlist")) {
      throw toCloudRuntimeActionError(
        error,
        "adminUpsertAllowlist",
        "إنشاء/تحديث المستخدم",
      );
    }

    if (isSchoolAdminRole(roleNorm)) {
      const linkRef = doc(db, "allowlist", email);
      const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

      await runTransaction(db, async (tx) => {
        const [linkSnap, tenantLinkSnap] = await Promise.all([
          tx.get(linkRef),
          tx.get(tenantLinkRef),
        ]);

        const existingEmailData = linkSnap.exists()
          ? ((linkSnap.data() as Record<string, unknown>) || {})
          : {};
        const existingEmailRole = String(existingEmailData?.role || "")
          .trim()
          .toLowerCase();
        const existingEmailTenantId = String(existingEmailData?.tenantId || "").trim();

        if (
          linkSnap.exists() &&
          isSchoolAdminRole(existingEmailRole) &&
          existingEmailTenantId &&
          existingEmailTenantId !== tenantId
        ) {
          throw new Error("هذا البريد الإلكتروني مرتبط مسبقًا بمدرسة أخرى.");
        }

        const existingTenantLinkData = tenantLinkSnap.exists()
          ? ((tenantLinkSnap.data() as Record<string, unknown>) || {})
          : {};
        const existingTenantEmail = String(existingTenantLinkData?.email || "")
          .trim()
          .toLowerCase();

        if (tenantLinkSnap.exists() && existingTenantEmail && existingTenantEmail !== email) {
          throw new Error("هذه المدرسة مرتبطة مسبقًا ببريد إلكتروني آخر.");
        }

        tx.set(
          linkRef,
          stripUndefined({
            email,
            enabled: tenantState.enabled,
            role: "tenant_admin",
            tenantId,
            governorate: governorateFinal,
            tenantGovernorate: governorateFinal,
            name: displayName,
            userName: displayName,
            schoolName,
            tenantName: schoolName,
            createdAt: serverTimestamp(),
            createdBy: user.email || "",
            updatedAt: serverTimestamp(),
            updatedBy: user.email || "",
          }),
          { merge: true },
        );

        tx.set(
          tenantLinkRef,
          {
            tenantId,
            email,
            governorate: governorateFinal,
            schoolName,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
    } else {
      await setDoc(
        doc(db, "allowlist", email),
        stripUndefined({
          email,
          enabled: !!newUserEnabled,
          role: roleNorm,
          tenantId,
          governorate: governorateFinal,
          name: displayName,
          userName: displayName,
          schoolName,
          tenantName: schoolName,
          tenantGovernorate: governorateFinal,
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
      enabled: isSchoolAdminRole(roleNorm) ? tenantState.enabled : !!newUserEnabled,
      name: displayName,
      schoolName,
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
      enabled: isSchoolAdminRole(roleNorm) ? tenantState.enabled : !!newUserEnabled,
      name: displayName,
      schoolName,
    },
  });
}

export async function updateAllowUserAction(args: any) {
  const { user, users, authzSnapshot, isSuper, resolveTenantGovernorate, email, patch } = args;
  const current = users.find(
    (u: any) => u.email.toLowerCase() === String(email).toLowerCase(),
  );
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
    governorateFinal =
      normalizeText(String((merged as any).governorate ?? "")) || undefined;
    if (!governorateFinal) {
      throw new Error("يجب تحديد المحافظة لسوبر المحافظات.");
    }
    if (governorateFinal === normalizeText(MINISTRY_SCOPE)) {
      throw new Error("سوبر المحافظات لا يمكن أن يكون على نطاق الوزارة.");
    }
  } else if (roleNorm === "ministry_super") {
    governorateFinal = normalizeText(String(MINISTRY_SCOPE)) || undefined;
  } else if (roleNorm === "tenant_admin" || String(roleNorm) === "admin") {
    governorateFinal =
      normalizeText(await resolveTenantGovernorate(String(merged.tenantId || ""))) ||
      undefined;
  }

  const tenantState = merged.tenantId
    ? await getTenantState(String(merged.tenantId || "").trim())
    : null;

  if (isSchoolAdminRole(roleNorm) && tenantState && !tenantState.enabled) {
    throw new Error(
      "هذه المدرسة غير مفعلة. لا يمكن تعديل ربط الأدمن أو نقله أو إلغاؤه حتى يتم تفعيل المدرسة أولاً.",
    );
  }

  const schoolName =
    String((merged as any).schoolName || "").trim() ||
    tenantState?.schoolName ||
    String(merged.tenantId || "").trim();

  const displayName =
    String((merged.name || (merged as any).userName || "")).trim() || schoolName;

  try {
    if (USE_FUNCTIONS) {
      await callFn<any, any>("adminUpsertAllowlist")({
        email: merged.email,
        tenantId: merged.tenantId,
        governorate: governorateFinal,
        enabled: isSchoolAdminRole(roleNorm)
          ? tenantState?.enabled ?? !!merged.enabled
          : !!merged.enabled,
        role: roleNorm,
        name: displayName,
        userName: displayName,
        schoolName,
        tenantName: schoolName,
        tenantGovernorate: governorateFinal,
      });
    } else {
      throw new Error("skip");
    }
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminUpsertAllowlist")) {
      throw toCloudRuntimeActionError(error, "adminUpsertAllowlist", "تعديل المستخدم");
    }

    if (isSchoolAdminRole(roleNorm)) {
      const linkRef = doc(db, "allowlist", merged.email);
      const tenantLinkRef = doc(db, "tenantAdminLinks", String(merged.tenantId || "").trim());

      await runTransaction(db, async (tx) => {
        const [linkSnap, tenantLinkSnap] = await Promise.all([
          tx.get(linkRef),
          tx.get(tenantLinkRef),
        ]);

        const existingTenantLinkData = tenantLinkSnap.exists()
          ? ((tenantLinkSnap.data() as Record<string, unknown>) || {})
          : {};
        const existingTenantEmail = String(existingTenantLinkData?.email || "")
          .trim()
          .toLowerCase();

        if (tenantLinkSnap.exists() && existingTenantEmail && existingTenantEmail !== merged.email) {
          throw new Error("هذه المدرسة مرتبطة مسبقًا ببريد إلكتروني آخر.");
        }

        tx.set(
          linkRef,
          stripUndefined({
            email: merged.email,
            tenantId: merged.tenantId,
            governorate: governorateFinal,
            tenantGovernorate: governorateFinal,
            enabled: tenantState?.enabled ?? !!merged.enabled,
            role: "tenant_admin",
            name: displayName,
            userName: displayName,
            schoolName,
            tenantName: schoolName,
            updatedAt: serverTimestamp(),
            updatedBy: user.email || "",
          }),
          { merge: true },
        );

        tx.set(
          tenantLinkRef,
          {
            tenantId: String(merged.tenantId || "").trim(),
            email: merged.email,
            governorate: governorateFinal,
            schoolName,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        if (linkSnap.exists()) {
          const oldData = (linkSnap.data() as Record<string, unknown>) || {};
          const oldTenantId = String(oldData?.tenantId || "").trim();
          if (
            oldTenantId &&
            oldTenantId !== String(merged.tenantId || "").trim()
          ) {
            const oldTenantLinkRef = doc(db, "tenantAdminLinks", oldTenantId);
            const oldTenantLinkSnap = await tx.get(oldTenantLinkRef);
            if (oldTenantLinkSnap.exists()) {
              const oldTenantLinkData =
                (oldTenantLinkSnap.data() as Record<string, unknown>) || {};
              const oldLinkedEmail = String(oldTenantLinkData?.email || "")
                .trim()
                .toLowerCase();
              if (!oldLinkedEmail || oldLinkedEmail === merged.email) {
                tx.delete(oldTenantLinkRef);
              }
            }
          }
        }
      });
    } else {
      await setDoc(
        doc(db, "allowlist", merged.email),
        stripUndefined({
          email: merged.email,
          tenantId: merged.tenantId,
          governorate: governorateFinal,
          enabled: !!merged.enabled,
          role: roleNorm,
          name: displayName,
          userName: displayName,
          schoolName,
          tenantName: schoolName,
          tenantGovernorate: governorateFinal,
          updatedAt: serverTimestamp(),
          updatedBy: user.email || "",
        }),
        { merge: true },
      );
    }
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

  const tenantId = String((item as any)?.tenantId || "").trim();
  if (tenantId && isSchoolAdminRole((item as any)?.role)) {
    const tenantState = await getTenantState(tenantId);
    if (!tenantState.enabled) {
      throw new Error(
        "هذه المدرسة غير مفعلة. لا يمكن إلغاء ربط الأدمن عنها حتى يتم تفعيلها أولاً.",
      );
    }

    const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);
    await runTransaction(db, async (tx) => {
      const tenantLinkSnap = await tx.get(tenantLinkRef);
      if (tenantLinkSnap.exists()) {
        const tenantLinkData = (tenantLinkSnap.data() as Record<string, unknown>) || {};
        const linkedEmail = String(tenantLinkData?.email || "").trim().toLowerCase();
        if (!linkedEmail || linkedEmail === emailLower) {
          tx.delete(tenantLinkRef);
        }
      }
      tx.delete(doc(db, "allowlist", emailLower));
    });
  } else {
    try {
      if (USE_FUNCTIONS) {
        await callFn<any, any>("adminDeleteAllowlist")({ email: emailLower });
      } else {
        throw new Error("skip");
      }
    } catch (error) {
      if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminDeleteAllowlist")) {
        throw toCloudRuntimeActionError(error, "adminDeleteAllowlist", "حذف المستخدم");
      }
      await deleteDoc(doc(db, "allowlist", emailLower));
    }
  }

  if (tenantId) {
    await writeSecurityAudit({
      type: "ALLOWLIST_DELETE",
      tenantId,
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

  const tenantState = await getTenantState(tid);

  await runTransaction(db, async (tx) => {
    const linkRef = doc(db, "allowlist", em);
    const tenantLinkRef = doc(db, "tenantAdminLinks", tid);

    const [linkSnap, tenantLinkSnap] = await Promise.all([
      tx.get(linkRef),
      tx.get(tenantLinkRef),
    ]);

    const existingEmailData = linkSnap.exists()
      ? ((linkSnap.data() as Record<string, unknown>) || {})
      : {};
    const existingEmailRole = String(existingEmailData?.role || "").trim().toLowerCase();
    const existingEmailTenantId = String(existingEmailData?.tenantId || "").trim();

    if (
      linkSnap.exists() &&
      isSchoolAdminRole(existingEmailRole) &&
      existingEmailTenantId &&
      existingEmailTenantId !== tid
    ) {
      throw new Error("هذا البريد الإلكتروني مرتبط مسبقًا بمدرسة أخرى.");
    }

    const existingTenantLinkData = tenantLinkSnap.exists()
      ? ((tenantLinkSnap.data() as Record<string, unknown>) || {})
      : {};
    const existingTenantEmail = String(existingTenantLinkData?.email || "")
      .trim()
      .toLowerCase();

    if (tenantLinkSnap.exists() && existingTenantEmail && existingTenantEmail !== em) {
      throw new Error("هذه المدرسة مرتبطة مسبقًا ببريد إلكتروني آخر.");
    }

    tx.set(
      linkRef,
      {
        email: em,
        enabled: tenantState.enabled,
        role: "tenant_admin",
        tenantId: tid,
        governorate: tenantState.governorate || undefined,
        tenantGovernorate: tenantState.governorate || undefined,
        name: tenantState.schoolName,
        userName: tenantState.schoolName,
        schoolName: tenantState.schoolName,
        tenantName: tenantState.schoolName,
        createdAt: serverTimestamp(),
        createdBy: user.email || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.email || "",
      },
      { merge: true },
    );

    tx.set(
      tenantLinkRef,
      {
        tenantId: tid,
        email: em,
        governorate: tenantState.governorate || undefined,
        schoolName: tenantState.schoolName,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}
