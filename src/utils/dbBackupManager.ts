import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

// =========================
// Full DB backup format (SAFE + Chunked)
// =========================
export type DbBackupMeta = {
  schema: string; // "db:v2"
  createdAtISO: string;
  tenantId: string;
  byUid?: string;
  byEmail?: string;
  note?: string;
};

export type DbBackupFile = {
  meta: DbBackupMeta;
  data: {
    // ✅ We store payload as one string OR chunked strings
    encoding: "json";
    payload?: string;        // when small enough
    chunks?: string[];       // when large
    chunked?: boolean;
    byteLen?: number;
    chunkCount?: number;
  };
};

export const DB_BACKUP_SCHEMA = "db:v2";

export const makeBackupId = () => "b_" + new Date().toISOString().replace(/[:.]/g, "-");

export const lastBackupKey = (tenantId: string) =>
  `exam-manager:cloud-backup:last:${tenantId}`;


// =========================
// Cloud backup retention policy
// =========================
// كل النسخ السابقة: 3 أسابيع. آخر نسخة: 6 أشهر.
export const STANDARD_BACKUP_RETENTION_DAYS = 21;
export const LATEST_BACKUP_RETENTION_MONTHS = 6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoFromMs(ms: number) {
  return new Date(ms).toISOString();
}

function addMonthsMs(ms: number, months: number) {
  const d = new Date(ms);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.getTime();
}

function timestampMsFromUnknown(value: any): number {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.toMillis === "function") {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function getBackupCreatedMs(row: any): number {
  return (
    timestampMsFromUnknown(row?.meta?.createdAtISO) ||
    timestampMsFromUnknown(row?.createdAtISO) ||
    timestampMsFromUnknown(row?.createdAt) ||
    Date.now()
  );
}

function buildLatestRetentionFields(createdAtISO: string) {
  const createdMs = timestampMsFromUnknown(createdAtISO) || Date.now();
  return {
    retentionPolicyVersion: "v1",
    retentionRole: "latest",
    retentionAnchorISO: isoFromMs(createdMs),
    retentionDemotedAtISO: null,
    retentionExpiresAtISO: isoFromMs(addMonthsMs(createdMs, LATEST_BACKUP_RETENTION_MONTHS)),
    retentionUpdatedAtISO: new Date().toISOString(),
    retentionLabelAr: "آخر نسخة - تحفظ لمدة ستة أشهر",
    retentionLabelEn: "Latest backup - kept for six months",
  };
}

function buildStandardRetentionFields(demotedOrCreatedAtISO: string) {
  const anchorMs = timestampMsFromUnknown(demotedOrCreatedAtISO) || Date.now();
  return {
    retentionPolicyVersion: "v1",
    retentionRole: "standard",
    retentionAnchorISO: isoFromMs(anchorMs),
    retentionDemotedAtISO: isoFromMs(anchorMs),
    retentionExpiresAtISO: isoFromMs(anchorMs + STANDARD_BACKUP_RETENTION_DAYS * MS_PER_DAY),
    retentionUpdatedAtISO: new Date().toISOString(),
    retentionLabelAr: "نسخة سابقة - تحذف بعد ثلاثة أسابيع",
    retentionLabelEn: "Previous backup - deleted after three weeks",
  };
}

function isDbBackupManagerDoc(row: any) {
  return row?.meta?.schema === DB_BACKUP_SCHEMA && String(row?.backupType || "") !== "full-program";
}

async function enforceDbBackupRetentionAfterUpload(tenantId: string, latestBackupId: string) {
  if (!tenantId || !latestBackupId) return;
  try {
    const ref = collection(db, "tenants", tenantId, "backups");
    const snap = await getDocs(query(ref, orderBy("meta.createdAtISO", "desc"), limit(100)));
    const nowMs = Date.now();

    for (const row of snap.docs) {
      const data = row.data() as any;
      if (!isDbBackupManagerDoc(data)) continue;

      if (row.id === latestBackupId) {
        const createdISO = String(data?.meta?.createdAtISO || data?.createdAtISO || new Date().toISOString());
        await setDoc(row.ref, buildLatestRetentionFields(createdISO), { merge: true });
        continue;
      }

      const existingDemotionISO = String(data?.retentionDemotedAtISO || "").trim();
      const createdISO = String(data?.meta?.createdAtISO || data?.createdAtISO || new Date(getBackupCreatedMs(data)).toISOString());
      const anchorISO = existingDemotionISO || new Date().toISOString();
      const expiresMs = (timestampMsFromUnknown(anchorISO) || nowMs) + STANDARD_BACKUP_RETENTION_DAYS * MS_PER_DAY;

      if (nowMs >= expiresMs) {
        await deleteDoc(row.ref);
        continue;
      }

      await setDoc(row.ref, buildStandardRetentionFields(existingDemotionISO || anchorISO || createdISO), { merge: true });
    }
  } catch {
    // سياسة الاحتفاظ لا يجب أن تكسر إنشاء النسخة نفسها.
  }
}

// =========================
// Safe localStorage backup / restore filters
// =========================
const LOCAL_STORAGE_KEY_DENY_PARTS = [
  "token",
  "auth",
  "firebase",
  "credential",
  "password",
  "secret",
  "session",
  "uid",
  "email",
  "role",
  "permission",
  "readonly",
  "read-only",
  "viewas",
  "governoratesuper",
  "selectedtenantid",
  "effectivetenantid",
  "tenantid",
  "cloud-backup:lock",
  "cloud-storage:last-error",
  "cloud-storage:last-warning",
  "cloud-cache",
  ":cache:",
];

export function shouldBackupLocalStorageKey(rawKey: unknown, tenantId?: string) {
  const key = String(rawKey || "").trim();
  if (!key) return false;
  const lower = key.toLowerCase();
  if (LOCAL_STORAGE_KEY_DENY_PARTS.some((part) => lower.includes(part))) return false;

  const allowedAppKey =
    key.startsWith("exam-manager:") ||
    key.startsWith("school-exam-manager:") ||
    key.startsWith("task-distribution:") ||
    key.includes(":task-distribution:") ||
    key.includes("examRoomAssignments");

  if (!allowedAppKey) return false;

  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return true;

  // المفاتيح العامة الآمنة التي لا تحمل tenant محدد مسموح بها.
  if (!lower.includes("tenant:") && !lower.includes("tenantid") && !key.includes(targetTenantId)) return true;
  return key.includes(targetTenantId);
}

export function shouldRestoreLocalStorageKey(rawKey: unknown, tenantId?: string) {
  return shouldBackupLocalStorageKey(rawKey, tenantId);
}

// =========================
// Local export as ONE payload
// =========================
export function exportLocalDatabase(prefix = "exam-manager", tenantId?: string) {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith(prefix)) continue;
    if (!shouldBackupLocalStorageKey(k, tenantId)) continue;
    out[k] = localStorage.getItem(k);
  }
  return out;
}

export function buildBackupPayload(args: { prefix?: string; tenantId?: string }) {
  const prefix = args.prefix || "exam-manager";
  const data = exportLocalDatabase(prefix, args.tenantId);
  return JSON.stringify({ prefix, data });
}

export function parseBackupPayload(payload: string): { prefix: string; data: Record<string, string | null> } {
  const obj = JSON.parse(payload || "{}");
  const prefix = String(obj?.prefix || "exam-manager");
  const data = (obj?.data && typeof obj.data === "object") ? (obj.data as Record<string, string | null>) : {};
  return { prefix, data };
}

// =========================
// Chunking helpers
// =========================
/**
 * Firestore doc limit ~1MB.
 * We chunk the payload to avoid exceeding it.
 *
 * We use a conservative chunk size (700KB) to leave room for meta/overhead.
 */
const MAX_CHUNK_BYTES = 700 * 1024;

function strByteLen(s: string) {
  // Accurate byte length in UTF-8
  return new TextEncoder().encode(s).length;
}

function splitToChunks(payload: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  // Split by characters but respect byte length (UTF-8)
  const chunks: string[] = [];
  let start = 0;

  while (start < payload.length) {
    let end = Math.min(payload.length, start + 500_000); // initial guess by chars
    // Adjust end until bytes fit
    while (end > start) {
      const part = payload.slice(start, end);
      if (strByteLen(part) <= maxBytes) {
        chunks.push(part);
        start = end;
        break;
      }
      end = Math.floor((start + end) / 2);
    }
    if (end === start) {
      // fallback (should be rare)
      chunks.push(payload.slice(start, start + 10_000));
      start = start + 10_000;
    }
  }
  return chunks;
}

function joinChunks(chunks: string[]) {
  return (chunks || []).join("");
}

// =========================
// Build / Validate
// =========================
export function buildBackupFile(args: {
  tenantId: string;
  byUid?: string;
  byEmail?: string;
  note?: string;
  prefix?: string;
}): DbBackupFile {
  const payload = buildBackupPayload({ prefix: args.prefix || "exam-manager", tenantId: args.tenantId });
  const bytes = strByteLen(payload);

  // ✅ chunk if too big
  if (bytes > MAX_CHUNK_BYTES) {
    const chunks = splitToChunks(payload, MAX_CHUNK_BYTES);
    return {
      meta: {
        schema: DB_BACKUP_SCHEMA,
        createdAtISO: new Date().toISOString(),
        tenantId: args.tenantId,
        byUid: args.byUid,
        byEmail: args.byEmail,
        note: args.note,
      },
      data: {
        encoding: "json",
        chunked: true,
        chunks,
        chunkCount: chunks.length,
        byteLen: bytes,
      },
    };
  }

  return {
    meta: {
      schema: DB_BACKUP_SCHEMA,
      createdAtISO: new Date().toISOString(),
      tenantId: args.tenantId,
      byUid: args.byUid,
      byEmail: args.byEmail,
      note: args.note,
    },
    data: {
      encoding: "json",
      payload,
      chunked: false,
      chunkCount: 1,
      byteLen: bytes,
    },
  };
}

export function validateBackupFile(file: any) {
  if (!file || typeof file !== "object") throw new Error("Invalid backup file");
  if (!file.meta || typeof file.meta !== "object") throw new Error("Missing meta");
  if (file.meta.schema !== DB_BACKUP_SCHEMA) throw new Error("Schema mismatch");
  if (!file.data || typeof file.data !== "object") throw new Error("Missing data");
  if (file.data.encoding !== "json") throw new Error("Invalid encoding");

  const hasPayload = typeof file.data.payload === "string";
  const hasChunks = Array.isArray(file.data.chunks) && file.data.chunks.every((x: any) => typeof x === "string");
  if (!hasPayload && !hasChunks) throw new Error("Missing payload/chunks");
}

export function getPayloadFromFile(file: DbBackupFile): string {
  validateBackupFile(file);
  if (file.data.payload) return file.data.payload;
  if (file.data.chunks?.length) return joinChunks(file.data.chunks);
  throw new Error("Missing payload");
}

export function previewImport(file: DbBackupFile, prefix = "exam-manager") {
  const payload = getPayloadFromFile(file);
  const parsed = parseBackupPayload(payload);

  const incomingKeys = Object.keys(parsed.data || {}).filter((k) => k.startsWith(prefix));

  const currentKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) currentKeys.push(k);
  }

  return {
    incoming: incomingKeys.length,
    current: currentKeys.length,
    willSet: incomingKeys.length,
  };
}

export function importDatabase(file: DbBackupFile, opts?: { prefix?: string; dryRun?: boolean; tenantId?: string }) {
  const expectedPrefix = opts?.prefix || "exam-manager";
  const payload = getPayloadFromFile(file);
  const parsed = parseBackupPayload(payload);

  const entries = Object.entries(parsed.data || {}).filter(
    ([k]) => k.startsWith(expectedPrefix) && shouldRestoreLocalStorageKey(k, opts?.tenantId)
  );

  if (opts?.dryRun) return { willSet: entries.length };

  for (const [k, v] of entries) {
    if (v === null || v === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, String(v));
  }

  return { set: entries.length };
}

// =========================
// Cloud (Firestore) backups
// tenants/{tenantId}/backups/{backupId}
// =========================
export async function uploadBackupToCloud(args: {
  tenantId: string;
  backupId?: string;
  file: DbBackupFile;
}) {
  const id = args.backupId || makeBackupId();
  const ref = doc(db, "tenants", args.tenantId, "backups", id);
  const createdAtISO = String(args.file?.meta?.createdAtISO || new Date().toISOString());

  await setDoc(ref, {
    ...args.file,
    backupId: id,
    ...buildLatestRetentionFields(createdAtISO),
  });

  await enforceDbBackupRetentionAfterUpload(args.tenantId, id);

  try {
    localStorage.setItem(lastBackupKey(args.tenantId), new Date().toISOString());
  } catch {}

  return id;
}

export async function listCloudBackups(tenantId: string, max = 50) {
  const ref = collection(db, "tenants", tenantId, "backups");
  const q = query(ref, orderBy("meta.createdAtISO", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function fetchCloudBackup(tenantId: string, backupId: string): Promise<DbBackupFile> {
  const ref = doc(db, "tenants", tenantId, "backups", backupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Backup not found");
  const data = snap.data() as any;
  return { meta: data.meta, data: data.data };
}

export async function deleteCloudBackup(tenantId: string, backupId: string) {
  await deleteDoc(doc(db, "tenants", tenantId, "backups", backupId));
}
