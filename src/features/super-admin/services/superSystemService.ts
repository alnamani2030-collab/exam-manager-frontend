import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import type { SuperSystemAllowDoc, SuperSystemTenant } from "../types";
import { MINISTRY_SCOPE } from "../../../constants/directorates";
import { safeTenantId } from "./superSystemShared";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type TenantAdminLinkDoc = {
  tenantId: string;
  email: string;
  governorate?: string;
  schoolName: string;
  updatedAt?: unknown;
};

function norm(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isSchoolAdminRoleValue(role: unknown) {
  const r = norm(role);
  return r === "tenant_admin" || r === "admin";
}

export function subscribeSuperTenants(
  onData: (rows: SuperSystemTenant[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const qTenants = query(collection(db, "tenants"), orderBy("updatedAt", "desc"), limit(500));

  return onSnapshot(
    qTenants,
    async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const base = (d.data() as Record<string, unknown>) || {};
          const id = d.id;

          let governorate = String(base?.governorate ?? "").trim();

          if (!governorate) {
            try {
              const cfg = await getDoc(doc(db, "tenants", id, "meta", "config"));
              governorate = String(
                (cfg.data() as Record<string, unknown> | undefined)?.governorate ?? "",
              ).trim();
            } catch {
              governorate = "";
            }
          }

          return {
            id,
            name: String(base?.name ?? id),
            enabled: base?.enabled !== false,
            updatedAt: base?.updatedAt,
            governorate,
          } satisfies SuperSystemTenant;
        }),
      );

      onData(rows);
    },
    (error) => onError?.(error),
  );
}

export async function loadTenantEditState(selectedTenantId: string) {
  const tSnap = await getDoc(doc(db, "tenants", selectedTenantId));
  const t = (tSnap.data() as Record<string, unknown>) || {};

  const cfgSnap = await getDoc(doc(db, "tenants", selectedTenantId, "meta", "config"));
  const cfg = (cfgSnap.data() as Record<string, unknown>) || {};

  return {
    name: String(cfg?.schoolNameAr || t?.name || selectedTenantId),
    enabled: Boolean(t?.enabled !== false && cfg?.enabled !== false),
    wilayatAr: String(cfg?.wilayatAr || ""),
    logoUrl: String(cfg?.logoUrl || MINISTRY_LOGO_URL),
  };
}

async function getTenantDocState(tenantId: string) {
  const [tSnap, cfgSnap] = await Promise.all([
    getDoc(doc(db, "tenants", tenantId)),
    getDoc(doc(db, "tenants", tenantId, "meta", "config")),
  ]);

  const t = (tSnap.data() as Record<string, unknown>) || {};
  const cfg = (cfgSnap.data() as Record<string, unknown>) || {};

  return {
    exists: tSnap.exists(),
    enabled: t?.enabled !== false && cfg?.enabled !== false,
    name: String(cfg?.schoolNameAr || t?.name || tenantId).trim(),
    governorate: String(cfg?.governorate || t?.governorate || "").trim(),
  };
}

async function getTenantAdminAllowlistDocs(
  tenantId: string,
  governorate?: string,
  restrictGovernorate: boolean = false,
) {
  const constraints: any[] = [
    where("tenantId", "==", tenantId),
    where("role", "in", ["tenant_admin", "admin"]),
  ];

  if (restrictGovernorate && governorate) {
    constraints.push(where("governorate", "==", governorate));
  }

  return getDocs(query(collection(db, "allowlist"), ...constraints));
}

export async function createTenantForScope(input: {
  tenantId: string;
  name: string;
  enabled: boolean;
  governorate?: string;
  canSeeAllGovs: boolean;
  myGov: string;
}) {
  const id = safeTenantId(input.tenantId);
  const name = String(input.name || "").trim();

  if (!id || !name) throw new Error("INVALID_TENANT_INPUT");

  const gov = input.canSeeAllGovs
    ? String(input.governorate || input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  if (!gov) throw new Error("MISSING_GOVERNORATE");

  const existingQ = query(collection(db, "tenants"), where(documentId(), "==", id), limit(1));
  const existing = await getDocs(existingQ);
  if (!existing.empty) throw new Error("TENANT_EXISTS");

  const tRef = doc(db, "tenants", id);
  const batch = writeBatch(db);

  batch.set(tRef, {
    name,
    enabled: !!input.enabled,
    governorate: gov,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(
    doc(db, "tenants", id, "meta", "config"),
    {
      governorate: gov,
      regionAr: gov,
      ministryAr: "سلطنة عمان - وزارة التعليم",
      schoolNameAr: name,
      systemNameAr: "نظام إدارة الامتحانات الذكي",
      wilayatAr: "",
      logoUrl: MINISTRY_LOGO_URL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
  return { tenantId: id };
}

export async function saveTenantForScope(input: {
  tenantId: string;
  name: string;
  enabled: boolean;
  wilayatAr: string;
  logoUrl: string;
  canSeeAllGovs: boolean;
  myGov: string;
}) {
  const tenantId = String(input.tenantId || "").trim();
  const schoolName = String(input.name || "").trim();

  const gov = input.canSeeAllGovs
    ? String(input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  if (!tenantId || !schoolName) throw new Error("INVALID_TENANT_INPUT");
  if (!input.canSeeAllGovs && !gov) throw new Error("MISSING_GOVERNORATE");

  const batch = writeBatch(db);

  batch.set(
    doc(db, "tenants", tenantId),
    {
      name: schoolName,
      enabled: !!input.enabled,
      governorate: gov,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(db, "tenants", tenantId, "meta", "config"),
    {
      governorate: gov,
      regionAr: gov,
      schoolNameAr: schoolName,
      wilayatAr: String(input.wilayatAr || "").trim(),
      logoUrl: String(input.logoUrl || "").trim() || MINISTRY_LOGO_URL,
      enabled: !!input.enabled,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const allowlistSnap = await getTenantAdminAllowlistDocs(
    tenantId,
    gov,
    !input.canSeeAllGovs,
  );

  for (const allowDoc of allowlistSnap.docs) {
    const allowData = (allowDoc.data() as Record<string, unknown>) || {};
    const existingUserName = String(allowData.userName || "").trim();
    const existingSchoolName = String(allowData.schoolName || allowData.tenantName || "").trim();

    const payload: Record<string, unknown> = {
      schoolName,
      tenantName: schoolName,
      governorate: gov,
      tenantGovernorate: gov,
      enabled: !!input.enabled,
      updatedAt: serverTimestamp(),
    };

    if (!existingUserName || existingUserName === existingSchoolName) {
      payload.userName = schoolName;
    }

    batch.set(allowDoc.ref, payload, { merge: true });
  }

  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);
  const tenantLinkSnap = await getDoc(tenantLinkRef);
  if (tenantLinkSnap.exists()) {
    const linkData = (tenantLinkSnap.data() as Record<string, unknown>) || {};
    batch.set(
      tenantLinkRef,
      {
        tenantId,
        email: String(linkData.email || "").trim().toLowerCase(),
        governorate: gov || undefined,
        schoolName,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();
}

export async function archiveAndDeleteTenant(input: {
  tenantId: string;
  deletedBy?: string;
  canSeeAllGovs?: boolean;
  myGov?: string;
}) {
  const id = String(input.tenantId || "").trim();
  if (!id) throw new Error("MISSING_TENANT_ID");

  const tenantState = await getTenantDocState(id);
  if (!tenantState.exists) throw new Error("TENANT_NOT_FOUND");

  const batch = writeBatch(db);

  batch.set(
    doc(db, "archiveTenants", id),
    {
      id,
      name: tenantState.name,
      governorate: tenantState.governorate,
      enabled: tenantState.enabled,
      deletedAt: serverTimestamp(),
      deletedBy: String(input.deletedBy || ""),
    },
    { merge: true },
  );

  const allowQs = await getTenantAdminAllowlistDocs(
    id,
    tenantState.governorate,
    !Boolean(input.canSeeAllGovs),
  );

  for (const allowDoc of allowQs.docs) {
    const data = (allowDoc.data() as Record<string, unknown>) || {};
    if (!isSchoolAdminRoleValue(data.role)) continue;

    if (!input.canSeeAllGovs) {
      const gov = String(data.governorate || data.tenantGovernorate || "").trim();
      if (gov !== String(input.myGov || "").trim()) continue;
    }

    batch.delete(allowDoc.ref);
  }

  batch.delete(doc(db, "tenantAdminLinks", id));
  batch.delete(doc(db, "tenants", id, "meta", "config"));
  batch.delete(doc(db, "tenants", id));

  await batch.commit();
}

export async function saveTenantAdminAssignment(input: {
  email: string;
  enabled: boolean;
  tenantId: string;
  tenantName?: string;
  tenantGovernorate?: string;
  canSeeAllGovs: boolean;
  myGov: string;
  userName?: string;
}) {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("INVALID_EMAIL");

  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) throw new Error("MISSING_TENANT_ID");

  const tenantState = await getTenantDocState(tenantId);
  if (!tenantState.exists) throw new Error("TENANT_NOT_FOUND");
  if (!tenantState.enabled) throw new Error("TENANT_DISABLED");

  const governorate = input.canSeeAllGovs
    ? String(input.tenantGovernorate || tenantState.governorate || input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || tenantState.governorate || "").trim();

  const schoolName = String(input.tenantName || tenantState.name || "").trim() || tenantId;
  const linkRef = doc(db, "allowlist", email);
  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

  await runTransaction(db, async (tx) => {
    const [emailLinkSnap, tenantLinkSnap] = await Promise.all([
      tx.get(linkRef),
      tx.get(tenantLinkRef),
    ]);

    if (emailLinkSnap.exists()) {
      const existingData = (emailLinkSnap.data() as Record<string, unknown>) || {};
      const existingTenantId = String(existingData.tenantId || "").trim();
      const existingRole = String(existingData.role || "").trim().toLowerCase();

      if (
        existingTenantId &&
        existingTenantId !== tenantId &&
        (existingRole === "tenant_admin" || existingRole === "admin")
      ) {
        const otherTenantState = await getTenantDocState(existingTenantId);
        if (!otherTenantState.enabled) {
          throw new Error("DISABLED_TENANT_LINK_LOCKED");
        }
        throw new Error("EMAIL_ALREADY_LINKED_TO_ANOTHER_TENANT");
      }
    }

    if (tenantLinkSnap.exists()) {
      const tenantLinkData = (tenantLinkSnap.data() as Record<string, unknown>) || {};
      const existingTenantEmail = String(tenantLinkData.email || "").trim().toLowerCase();
      if (existingTenantEmail && existingTenantEmail !== email) {
        throw new Error("TENANT_ALREADY_LINKED_TO_ANOTHER_EMAIL");
      }
    }

    const payload: SuperSystemAllowDoc = {
      email,
      enabled: !!input.enabled && tenantState.enabled,
      role: "tenant_admin" as any,
      tenantId,
      governorate,
      schoolName,
      tenantName: schoolName,
      tenantGovernorate: governorate || undefined,
      userName: String(input.userName || "").trim() || undefined,
      updatedAt: serverTimestamp(),
    } as SuperSystemAllowDoc;

    const tenantLinkPayload: TenantAdminLinkDoc = {
      tenantId,
      email,
      governorate: governorate || undefined,
      schoolName,
      updatedAt: serverTimestamp(),
    };

    tx.set(linkRef, payload, { merge: true });
    tx.set(tenantLinkRef, tenantLinkPayload, { merge: true });
  });

  return { email };
}

export async function deleteTenantAdminAssignment(input: {
  email: string;
  tenantId: string;
}) {
  const email = String(input.email || "").trim().toLowerCase();
  const tenantId = String(input.tenantId || "").trim();

  if (!email) throw new Error("MISSING_EMAIL");
  if (!tenantId) throw new Error("MISSING_TENANT_ID");

  const tenantState = await getTenantDocState(tenantId);
  if (!tenantState.exists) throw new Error("TENANT_NOT_FOUND");
  if (!tenantState.enabled) throw new Error("TENANT_DISABLED_LINK_CHANGE_BLOCKED");

  const linkRef = doc(db, "allowlist", email);
  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

  await runTransaction(db, async (tx) => {
    const [linkSnap, tenantLinkSnap] = await Promise.all([tx.get(linkRef), tx.get(tenantLinkRef)]);

    if (linkSnap.exists()) {
      const linkData = (linkSnap.data() as Record<string, unknown>) || {};
      const linkedTenantId = String(linkData.tenantId || "").trim();
      const linkRole = String(linkData.role || "").trim().toLowerCase();

      if (
        linkedTenantId &&
        linkedTenantId !== tenantId &&
        (linkRole === "tenant_admin" || linkRole === "admin")
      ) {
        throw new Error("EMAIL_LINKED_TO_ANOTHER_TENANT");
      }

      tx.delete(linkRef);
    }

    if (tenantLinkSnap.exists()) {
      const tenantLinkData = (tenantLinkSnap.data() as Record<string, unknown>) || {};
      const linkedEmail = String(tenantLinkData.email || "").trim().toLowerCase();

      if (!linkedEmail || linkedEmail === email) {
        tx.delete(tenantLinkRef);
      }
    }
  });
}

export async function disableAllowlistForTenant(tenantId: string) {
  const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));

  await Promise.all(
    qs.docs.map((d) =>
      updateDoc(d.ref, {
        enabled: false,
        updatedAt: serverTimestamp(),
      }),
    ),
  );
}
