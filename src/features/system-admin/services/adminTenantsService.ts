import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
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

function normalizeTenantSchoolName(config: TenantConfig, fallbackName = "") {
  return String((config as any)?.schoolNameAr || fallbackName || "").trim();
}

async function syncTenantAdminBindings(args: {
  tenantId: string;
  schoolName: string;
  governorate: string;
  enabled?: boolean;
  actorEmail?: string;
}) {
  const { tenantId, schoolName, governorate, enabled, actorEmail } = args;
  const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));
  const batch = writeBatch(db);

  let linkedEmail = "";
  for (const d of qs.docs) {
    const data = (d.data() as Record<string, unknown>) || {};
    const role = String(data?.role || "").trim().toLowerCase();
    if (role !== "tenant_admin" && role !== "admin") continue;

    const currentSchoolName = String(data?.schoolName || data?.tenantName || "").trim();
    const currentUserName = String(data?.userName || data?.name || "").trim();
    const email = String(data?.email || d.id || "").trim().toLowerCase();
    if (email && !linkedEmail) linkedEmail = email;

    const payload: Record<string, unknown> = {
      schoolName,
      tenantName: schoolName,
      governorate,
      tenantGovernorate: governorate,
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail || "",
    };

    if (typeof enabled === "boolean") {
      payload.enabled = enabled;
    }

    if (!currentUserName || currentUserName === currentSchoolName) {
      payload.userName = schoolName;
      payload.name = schoolName;
    }

    batch.set(d.ref, payload, { merge: true });
  }

  if (linkedEmail) {
    batch.set(
      doc(db, "tenantAdminLinks", tenantId),
      {
        tenantId,
        email: linkedEmail,
        schoolName,
        governorate,
        updatedAt: serverTimestamp(),
        updatedBy: actorEmail || "",
      },
      { merge: true },
    );
  }

  await batch.commit();
}

export async function createTenantAction(args: {
  user: any;
  tenantId: string;
  tenantName: string;
  enabled: boolean;
}) {
  const { user, tenantId, tenantName, enabled } = args;
  const tenantRef = doc(db, "tenants", tenantId);
  const exist = await getDoc(tenantRef);
  if (exist.exists()) throw new Error("Tenant بهذا الـ ID موجود مسبقاً.");

  if (USE_FUNCTIONS) {
    try {
      await callFn<any, any>("adminUpsertTenant")({
        tenantId,
        name: tenantName.trim(),
        enabled: !!enabled,
      });
    } catch (error) {
      if (isStrictCloudRuntimeFunction("adminUpsertTenant")) {
        throw toCloudRuntimeActionError(error, "adminUpsertTenant", "إنشاء المدرسة");
      }
      await setDoc(
        tenantRef,
        {
          name: tenantName.trim(),
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
        name: tenantName.trim(),
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

  await writeSecurityAudit({
    type: "TENANT_CREATE",
    tenantId,
    actorUid: user.uid,
    actorEmail: user.email || "",
    details: { name: tenantName.trim(), enabled: !!enabled },
  });

  await logActivity(tenantId, {
    actorUid: user.uid,
    actorEmail: user.email || "",
    action: "TENANT_CREATED",
    entity: "tenant",
    entityId: tenantId,
    meta: { name: tenantName.trim(), enabled: !!enabled },
  });

  await setDoc(
    doc(db, "tenants", tenantId, "meta", "config"),
    {
      ministryAr: "سلطنة عمان - وزارة التعليم",
      schoolNameAr: tenantName.trim(),
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
    details: { step: "config_init", governorate: "", schoolNameAr: tenantName.trim() },
  });
}

export async function saveTenantConfigAction(args: {
  user: any;
  tenantId: string;
  config: TenantConfig;
}) {
  const { user, tenantId, config } = args;
  const normalizedGov = String((config as any).governorate || (config as any).regionAr || "").trim();

  const tenantRef = doc(db, "tenants", tenantId);
  const tenantSnap = await getDoc(tenantRef);
  const tenantData = tenantSnap.exists() ? (tenantSnap.data() as any) : {};
  const fallbackSchoolName = String(tenantData?.name || "").trim();
  const schoolName = normalizeTenantSchoolName(config, fallbackSchoolName);

  await setDoc(
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

  await setDoc(
    tenantRef,
    {
      name: schoolName || fallbackSchoolName,
      governorate: normalizedGov,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || "",
    },
    { merge: true },
  );

  const effectiveEnabled = tenantData?.enabled !== false;
  await syncTenantAdminBindings({
    tenantId,
    schoolName: schoolName || fallbackSchoolName,
    governorate: normalizedGov,
    enabled: effectiveEnabled,
    actorEmail: user.email || "",
  });

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

  if (USE_FUNCTIONS) {
    try {
      await callFn<any, any>("adminUpsertTenant")({ tenantId, enabled });
    } catch (error) {
      if (isStrictCloudRuntimeFunction("adminUpsertTenant")) {
        throw toCloudRuntimeActionError(error, "adminUpsertTenant", "تحديث حالة المدرسة");
      }
      await setDoc(
        doc(db, "tenants", tenantId),
        { enabled, updatedAt: serverTimestamp(), updatedBy: user.email || "" },
        { merge: true },
      );
    }
  } else {
    await setDoc(
      doc(db, "tenants", tenantId),
      { enabled, updatedAt: serverTimestamp(), updatedBy: user.email || "" },
      { merge: true },
    );
  }

  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  const tenantData = tenantSnap.exists() ? (tenantSnap.data() as any) : {};
  const cfgSnap = await getDoc(doc(db, "tenants", tenantId, "meta", "config"));
  const cfgData = cfgSnap.exists() ? (cfgSnap.data() as any) : {};
  const schoolName = String(cfgData?.schoolNameAr || tenantData?.name || tenantId).trim();
  const governorate = String(cfgData?.governorate || cfgData?.regionAr || tenantData?.governorate || "").trim();

  await syncTenantAdminBindings({
    tenantId,
    schoolName,
    governorate,
    enabled,
    actorEmail: user.email || "",
  });

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
    } catch {
      // ignore
    }
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminDeleteTenant")) {
      throw toCloudRuntimeActionError(error, "adminDeleteTenant", "حذف المدرسة");
    }

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

    const batch = writeBatch(db);
    if (alsoDeleteUsers) {
      const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));
      qs.forEach((d) => batch.delete(d.ref));
    } else {
      const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));
      qs.forEach((d) =>
        batch.set(
          d.ref,
          {
            enabled: false,
            updatedAt: serverTimestamp(),
            updatedBy: user.email || "",
          },
          { merge: true },
        ),
      );
    }

    batch.delete(doc(db, "tenantAdminLinks", tenantId));
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
