import {
  collection,
  doc,
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
  schoolName?: string;
  updatedAt?: unknown;
};

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
    name: String(t?.name || selectedTenantId),
    enabled: Boolean(t?.enabled),
    wilayatAr: String(cfg?.wilayatAr || ""),
    logoUrl: String(cfg?.logoUrl || MINISTRY_LOGO_URL),
  };
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
    ? String(input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  if (!gov) throw new Error("MISSING_GOVERNORATE");

  const tRef = doc(db, "tenants", id);
  const existing = await getDoc(tRef);
  if (existing.exists()) throw new Error("TENANT_EXISTS");

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
  const gov = input.canSeeAllGovs
    ? String(input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  if (!input.canSeeAllGovs && !gov) throw new Error("MISSING_GOVERNORATE");

  await setDoc(
    doc(db, "tenants", input.tenantId),
    {
      name: String(input.name || "").trim(),
      enabled: !!input.enabled,
      governorate: gov,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "tenants", input.tenantId, "meta", "config"),
    {
      governorate: gov,
      regionAr: gov,
      schoolNameAr: String(input.name || "").trim(),
      wilayatAr: String(input.wilayatAr || "").trim(),
      logoUrl: String(input.logoUrl || "").trim() || MINISTRY_LOGO_URL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function archiveAndDeleteTenant(input: {
  tenantId: string;
  deletedBy?: string;
  canSeeAllGovs?: boolean;
  myGov?: string;
}) {
  const id = String(input.tenantId || "").trim();
  if (!id) throw new Error("MISSING_TENANT_ID");

  const tRef = doc(db, "tenants", id);
  const tSnap = await getDoc(tRef);
  const data = tSnap.exists() ? (tSnap.data() as Record<string, unknown>) : {};

  const allowQs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", id)));
  const tenantLinkRef = doc(db, "tenantAdminLinks", id);

  const batch = writeBatch(db);

  batch.set(
    doc(db, "archiveTenants", id),
    {
      ...data,
      id,
      deletedAt: serverTimestamp(),
      deletedBy: String(input.deletedBy || ""),
    },
    { merge: true },
  );

  for (const allowDoc of allowQs.docs) {
    batch.delete(allowDoc.ref);
  }

  batch.delete(tenantLinkRef);
  batch.delete(doc(db, "tenants", id, "meta", "config"));
  batch.delete(tRef);

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

  const governorate = input.canSeeAllGovs
    ? String(input.tenantGovernorate || input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  const schoolName = String(input.tenantName || "").trim() || tenantId;
  const linkRef = doc(db, "allowlist", email);
  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

  await runTransaction(db, async (tx) => {
    const tenantRef = doc(db, "tenants", tenantId);
    const [tenantSnap, linkSnap, tenantLinkSnap] = await Promise.all([
      tx.get(tenantRef),
      tx.get(linkRef),
      tx.get(tenantLinkRef),
    ]);

    if (!tenantSnap.exists()) {
      throw new Error("TENANT_NOT_FOUND");
    }

    const existingEmailData = linkSnap.exists()
      ? (linkSnap.data() as Record<string, unknown>)
      : null;
    const existingEmailRole = String(existingEmailData?.role || "").trim().toLowerCase();
    const existingEmailTenantId = String(existingEmailData?.tenantId || "").trim();

    if (
      linkSnap.exists() &&
      (existingEmailRole === "tenant_admin" || existingEmailRole === "admin") &&
      existingEmailTenantId &&
      existingEmailTenantId !== tenantId
    ) {
      throw new Error("EMAIL_ALREADY_LINKED_TO_ANOTHER_TENANT");
    }

    const existingTenantLinkData = tenantLinkSnap.exists()
      ? (tenantLinkSnap.data() as Record<string, unknown>)
      : null;
    const existingTenantEmail = String(existingTenantLinkData?.email || "").trim().toLowerCase();

    if (tenantLinkSnap.exists() && existingTenantEmail && existingTenantEmail !== email) {
      throw new Error("TENANT_ALREADY_LINKED_TO_ANOTHER_EMAIL");
    }

    const payload: SuperSystemAllowDoc = {
      email,
      enabled: !!input.enabled,
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

  const linkRef = doc(db, "allowlist", email);
  const tenantLinkRef = doc(db, "tenantAdminLinks", tenantId);

  await runTransaction(db, async (tx) => {
    const [linkSnap, tenantLinkSnap] = await Promise.all([tx.get(linkRef), tx.get(tenantLinkRef)]);

    if (linkSnap.exists()) {
      const linkData = (linkSnap.data() as Record<string, unknown>) || {};
      const linkedTenantId = String(linkData?.tenantId || "").trim();
      const linkRole = String(linkData?.role || "").trim().toLowerCase();

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
      const linkedEmail = String(tenantLinkData?.email || "").trim().toLowerCase();

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
