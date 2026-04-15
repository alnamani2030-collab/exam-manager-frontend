import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { callFn } from "../../../services/functionsClient";
import {
  isStrictCloudRuntimeFunction,
  toCloudRuntimeActionError,
} from "../../../services/functionsRuntimePolicy";
import { logActivity } from "../../../services/activityLog.service";
import { writeSecurityAudit } from "../../../services/securityAudit";
import type { TenantConfig } from "../types";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const USE_FUNCTIONS = !Boolean((import.meta as any).env?.DEV);

function isSchoolAdminRole(role: unknown) {
  const value = String(role || "").trim().toLowerCase();
  return value === "tenant_admin" || value === "admin";
}

export async function createTenantAction(args: {
  user: any;
  tenantId: string;
  tenantName: string;
  enabled: boolean;
}) {
  const { user, tenantId, tenantName, enabled } = args;
  const schoolName = String(tenantName || "").trim();
  const tenantRef = doc(db, "tenants", tenantId);
  const exist = await getDoc(tenantRef);
  if (exist.exists()) throw new Error("Tenant بهذا الـ ID موجود مسبقاً.");

  if (USE_FUNCTIONS) {
    try {
      await callFn<any, any>("adminUpsertTenant")({
        tenantId,
        name: schoolName,
        enabled: !!enabled,
      });
    } catch (error) {
      if (isStrictCloudRuntimeFunction("adminUpsertTenant")) {
        throw toCloudRuntimeActionError(error, "adminUpsertTenant", "إنشاء المدرسة");
      }
      await setDoc(
        tenantRef,
        {
          name: schoolName,
          enabled: !!enabled,
          deleted: false,
          createdAt: serverTimestamp(),
          createdBy: user.email || "",
          updatedAt: serverTimestamp(),
          updatedBy: user.email || "",
        },
        { merge: true },
      );
    }
  } else {
    await setDoc(
      tenantRef,
      {
        name: schoolName,
        enabled: !!enabled,
        deleted: false,
        createdAt: serverTimestamp(),
        createdBy: user.email || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.email || "",
      },
      { merge: true },
    );
  }

  await setDoc(
    doc(db, "tenants", tenantId, "meta", "config"),
    {
      ministryAr: "سلطنة عمان - وزارة التعليم",
      schoolNameAr: schoolName,
      systemNameAr: "نظام إدارة الامتحانات الذكي",
      governorate: "",
      regionAr: "",
      wilayatAr: "",
      logoUrl: MINISTRY_LOGO_URL,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    },
    { merge: true },
  );

  await setDoc(
    tenantRef,
    {
      governorate: "",
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    },
    { merge: true },
  );

  await writeSecurityAudit({
    type: "TENANT_CREATE",
    tenantId,
    actorUid: user.uid,
    actorEmail: user.email || "",
    details: { name: schoolName, enabled: !!enabled },
  });

  await logActivity(tenantId, {
    actorUid: user.uid,
    actorEmail: user.email || "",
    action: "TENANT_CREATED",
    entity: "tenant",
    entityId: tenantId,
    meta: { name: schoolName, enabled: !!enabled },
  });
}

export async function saveTenantConfigAction(args: {
  user: any;
  tenantId: string;
  config: TenantConfig;
}) {
  const { user, tenantId, config } = args;
  const tenantRef = doc(db, "tenants", tenantId);
  const tenantSnap = await getDoc(tenantRef);
  const tenantData = tenantSnap.exists()
    ? ((tenantSnap.data() as Record<string, unknown>) || {})
    : {};

  const previousSchoolName = String(tenantData?.name || "").trim();
  const normalizedGov = String(
    (config as any).governorate || (config as any).regionAr || "",
  ).trim();
  const schoolName = String(
    (config as any)?.schoolNameAr || previousSchoolName || tenantId,
  ).trim();

  const batch = writeBatch(db);

  batch.set(
    doc(db, "tenants", tenantId, "meta", "config"),
    {
      ...config,
      governorate: normalizedGov,
      regionAr: (config as any).regionAr || normalizedGov,
      schoolNameAr: schoolName,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    },
    { merge: true },
  );

  batch.set(
    tenantRef,
    {
      name: schoolName,
      governorate: normalizedGov,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    },
    { merge: true },
  );

  const allowlistSnap = await getDocs(
    query(collection(db, "allowlist"), where("tenantId", "==", tenantId)),
  );

  let linkedEmail = "";
  for (const allowDoc of allowlistSnap.docs) {
    const allowData = ((allowDoc.data() as Record<string, unknown>) || {});
    if (!isSchoolAdminRole(allowData?.role)) continue;

    const email = String(allowData?.email || allowDoc.id || "").trim().toLowerCase();
    const existingUserName = String(
      allowData?.userName || allowData?.name || "",
    ).trim();
    const existingSchoolName = String(
      allowData?.schoolName || allowData?.tenantName || previousSchoolName || "",
    ).trim();

    const payload: Record<string, unknown> = {
      schoolName,
      tenantName: schoolName,
      governorate: normalizedGov,
      tenantGovernorate: normalizedGov,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    };

    if (
      !existingUserName ||
      existingUserName === existingSchoolName ||
      (previousSchoolName && existingUserName === previousSchoolName)
    ) {
      payload.userName = schoolName;
      payload.name = schoolName;
    }

    batch.set(allowDoc.ref, payload, { merge: true });

    if (!linkedEmail && email) {
      linkedEmail = email;
    }
  }

  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);
  const tenantLinkSnap = await getDoc(tenantLinkRef);
  const tenantLinkData = tenantLinkSnap.exists()
    ? ((tenantLinkSnap.data() as Record<string, unknown>) || {})
    : {};
  const linkEmail = String(tenantLinkData?.email || linkedEmail || "")
    .trim()
    .toLowerCase();

  if (linkEmail) {
    batch.set(
      tenantLinkRef,
      {
        tenantId,
        email: linkEmail,
        schoolName,
        governorate: normalizedGov,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();

  await writeSecurityAudit({
    type: "TENANT_UPDATE",
    tenantId,
    actorUid: user.uid,
    actorEmail: user.email || "",
    details: {
      governorate: normalizedGov,
      schoolNameAr: schoolName,
      step: "config_update",
    },
  });

  await logActivity(tenantId, {
    actorUid: user.uid,
    actorEmail: user.email || "",
    action: "TENANT_CONFIG_UPDATED",
    entity: "tenant-config",
    entityId: tenantId,
    meta: { governorate: normalizedGov, schoolNameAr: schoolName },
  });
}

export async function toggleTenantEnabledAction(args: {
  user: any;
  tenantId: string;
  enabled: boolean;
}) {
  const { user, tenantId, enabled } = args;
  const tenantRef = doc(db, "tenants", tenantId);

  if (USE_FUNCTIONS) {
    try {
      await callFn<any, any>("adminUpsertTenant")({ tenantId, enabled });
    } catch (error) {
      if (isStrictCloudRuntimeFunction("adminUpsertTenant")) {
        throw toCloudRuntimeActionError(
          error,
          "adminUpsertTenant",
          "تحديث حالة المدرسة",
        );
      }
      await setDoc(
        tenantRef,
        {
          enabled,
          updatedAt: serverTimestamp(),
          updatedBy: user.email || "",
        },
        { merge: true },
      );
    }
  } else {
    await setDoc(
      tenantRef,
      {
        enabled,
        updatedAt: serverTimestamp(),
        updatedBy: user.email || "",
      },
      { merge: true },
    );
  }

  const allowlistSnap = await getDocs(
    query(collection(db, "allowlist"), where("tenantId", "==", tenantId)),
  );

  const batch = writeBatch(db);
  for (const allowDoc of allowlistSnap.docs) {
    const allowData = ((allowDoc.data() as Record<string, unknown>) || {});
    if (!isSchoolAdminRole(allowData?.role)) continue;

    batch.set(
      allowDoc.ref,
      {
        enabled: !!enabled,
        updatedAt: serverTimestamp(),
        updatedBy: user.email || "",
      },
      { merge: true },
    );
  }

  if (!allowlistSnap.empty) {
    await batch.commit();
  }

  await writeSecurityAudit({
    type: "TENANT_UPDATE",
    tenantId,
    actorUid: user.uid,
    actorEmail: user.email || "",
    details: { enabled },
  });
}

export async function deleteTenantAction(args: {
  user: any;
  tenantId: string;
  alsoDeleteUsers: boolean;
}) {
  const { user, tenantId, alsoDeleteUsers } = args;
  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

  try {
    await callFn<any, any>("adminDeleteTenant")({ tenantId, alsoDeleteUsers });
    try {
      await setDoc(
        doc(db, "tenants", tenantId),
        {
          deleted: true,
          enabled: false,
          deletedAt: serverTimestamp(),
          deletedBy: user.email || null,
        },
        { merge: true },
      );
      await setDoc(
        doc(db, "tenants", tenantId, "meta", "config"),
        {
          deleted: true,
          enabled: false,
          updatedAt: serverTimestamp(),
          updatedBy: user.email || null,
        },
        { merge: true },
      );
      await setDoc(
        tenantLinkRef,
        {
          deleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // ignore
    }
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminDeleteTenant")) {
      throw toCloudRuntimeActionError(error, "adminDeleteTenant", "حذف المدرسة");
    }

    const batch = writeBatch(db);

    batch.set(
      doc(db, "tenants", tenantId),
      {
        deleted: true,
        enabled: false,
        deletedAt: serverTimestamp(),
        deletedBy: user.email || null,
      },
      { merge: true },
    );

    batch.set(
      doc(db, "tenants", tenantId, "meta", "config"),
      {
        deleted: true,
        enabled: false,
        updatedAt: serverTimestamp(),
        updatedBy: user.email || null,
      },
      { merge: true },
    );

    batch.delete(tenantLinkRef);

    if (alsoDeleteUsers) {
      const qs = await getDocs(
        query(collection(db, "allowlist"), where("tenantId", "==", tenantId)),
      );
      qs.forEach((d) => {
        batch.delete(d.ref);
      });
    }

    await batch.commit();
  }

  await writeSecurityAudit({
    type: "TENANT_DELETE",
    tenantId,
    actorUid: user.uid,
    actorEmail: user.email || "",
    details: { alsoDeleteUsers: !!alsoDeleteUsers, via: "adminDeleteTenant" },
  });
}
