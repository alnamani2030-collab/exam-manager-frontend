import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";
import nodemailer from "nodemailer";
import * as crypto from "crypto";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

const db = admin.firestore();

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

const corsHandler = cors({
  origin: getAllowedOrigins(),
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

type Role = "super_admin" | "super" | "tenant_admin" | "admin" | "user" | "exam_super" | "ministry_super";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeSegment(value: string, label: string) {
  const segment = clean(value);
  if (!segment) {
    throw new functions.https.HttpsError("invalid-argument", `${label} is required`);
  }

  if (segment.includes("/") || segment.includes("\\")) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid ${label}`);
  }

  return segment;
}

function safeOptionalSegment(value: string, label: string) {
  const segment = clean(value);
  if (!segment) return "";
  if (segment.includes("/") || segment.includes("\\")) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid ${label}`);
  }
  return segment;
}

async function getAllowlistByEmail(email: string) {
  const safeEmail = clean(email);
  if (!safeEmail) return null;

  const snap = await db.collection("allowlist").doc(safeEmail).get();
  return snap.exists ? snap.data() || null : null;
}

async function getAuthContext(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const token: any = context.auth.token || {};
  const email = clean(token.email);
  const allow = await getAllowlistByEmail(email);

  const ownerEmail = "3asal2030@gmail.com";
  const isOwner = email === ownerEmail;

  const role = isOwner
    ? "super_admin"
    : clean(token.role || allow?.role || "user");

  const enabled =
    isOwner ||
    token.enabled === true ||
    allow?.enabled === true;

  const tenantId = clean(token.tenantId || allow?.tenantId || "");
  const governorate = clean(token.governorate || allow?.governorate || "");

  if (!enabled) {
    throw new functions.https.HttpsError("permission-denied", "USER_DISABLED_OR_NOT_ALLOWED");
  }

  return {
    uid: context.auth.uid,
    email,
    role: role as Role,
    tenantId,
    governorate,
    isOwner,
    isSuperAdmin: isOwner || role === "super_admin" || token.isOwner === true,
    isSuperRegional: role === "super",
  };
}

async function verifyIdTokenFromRequest(req: functions.https.Request) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

async function getHttpAuthContext(req: functions.https.Request) {
  const token: any = await verifyIdTokenFromRequest(req);
  if (!token) return null;

  const email = clean(token.email);
  const allow = await getAllowlistByEmail(email);

  const ownerEmail = "3asal2030@gmail.com";
  const isOwner = email === ownerEmail;

  const role = isOwner
    ? "super_admin"
    : clean(token.role || allow?.role || "user");

  const enabled =
    isOwner ||
    token.enabled === true ||
    allow?.enabled === true;

  const tenantId = clean(token.tenantId || allow?.tenantId || "");
  const governorate = clean(token.governorate || allow?.governorate || "");

  if (!enabled) return null;

  return {
    uid: token.uid,
    email,
    displayName: clean(token.name),
    role: role as Role,
    tenantId,
    governorate,
    isOwner,
    isSuperAdmin: isOwner || role === "super_admin" || token.isOwner === true,
    isSuperRegional: role === "super",
  };
}

async function tenantGovernorate(tenantId: string) {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};

  const metaSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("meta")
    .doc("config")
    .get();

  const metaData = metaSnap.exists ? metaSnap.data() || {} : {};

  return clean(metaData.governorate || tenantData.governorate || "");
}

async function canReadTenant(
  auth:
    | Awaited<ReturnType<typeof getAuthContext>>
    | NonNullable<Awaited<ReturnType<typeof getHttpAuthContext>>>,
  tenantId: string
) {
  if (auth.isSuperAdmin) return true;
  if (auth.tenantId && auth.tenantId === tenantId) return true;

  if (auth.isSuperRegional) {
    if (auth.governorate === "الوزارة") return true;
    return (await tenantGovernorate(tenantId)) === auth.governorate;
  }

  return false;
}

async function canWriteTenant(
  auth:
    | Awaited<ReturnType<typeof getAuthContext>>
    | NonNullable<Awaited<ReturnType<typeof getHttpAuthContext>>>,
  tenantId: string
) {
  if (auth.isSuperAdmin) return true;

  // Commercial mode:
  // - Governorate supervisors can read tenants in their governorate, but they do not edit tenant files.
  // - School admins and diploma exam-center heads have full write permissions only in their own tenant.
  if (!auth.tenantId || auth.tenantId !== tenantId) return false;

  return ["tenant_admin", "exam_super", "admin"].includes(auth.role);
}

function sanitizeWriteData(data: any, id: string, auth: { uid?: string; email?: string }) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    ...(data || {}),
    id,
    updatedAt: now,
    updatedBy: auth.email || auth.uid || null,
  };
}

type TenantListDocsReq = {
  tenantId: string;
  sub: string;
  limit?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
};

export const tenantListDocs = functions.https.onCall(
  async (req: TenantListDocsReq, context) => {
    const auth = await getAuthContext(context);

    const tenantId = safeSegment(req?.tenantId, "tenantId");
    const sub = safeSegment(req?.sub, "subcollection");

    if (!(await canReadTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_ACCESS_DENIED");
    }

    const max = Math.min(Math.max(Number(req?.limit || 200), 1), 1000);
    const orderByField =
      safeOptionalSegment(String(req?.orderBy || "createdAt"), "orderBy") || "createdAt";
    const dir = (req?.orderDir || "desc") as "asc" | "desc";

    let q = db
      .collection("tenants")
      .doc(tenantId)
      .collection(sub) as FirebaseFirestore.Query;

    try {
      q = q.orderBy(orderByField, dir).limit(max);
    } catch {
      q = q.limit(max);
    }

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { items };
  }
);

type TenantUpsertDocReq = {
  tenantId: string;
  sub: string;
  id: string;
  data: any;
};

export const tenantUpsertDoc = functions.https.onCall(
  async (req: TenantUpsertDocReq, context) => {
    const auth = await getAuthContext(context);

    const tenantId = safeSegment(req?.tenantId, "tenantId");
    const sub = safeSegment(req?.sub, "subcollection");
    const id = safeSegment(req?.id, "doc id");

    if (!(await canWriteTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_WRITE_DENIED");
    }

    const ref = db.collection("tenants").doc(tenantId).collection(sub).doc(id);
    const before = await ref.get();

    await ref.set(sanitizeWriteData(req?.data || {}, id, auth), { merge: true });

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: before.exists ? "UPDATE" : "CREATE",
      entityType: sub,
      entityId: id,
      actorUid: auth.uid,
      actorEmail: auth.email,
      before: before.exists ? before.data() : null,
      after: req?.data || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "tenantUpsertDoc",
    });

    return { ok: true, id };
  }
);

type TenantDeleteDocReq = {
  path: string;
};

export const tenantDeleteDoc = functions.https.onCall(
  async (req: TenantDeleteDocReq, context) => {
    const auth = await getAuthContext(context);
    const path = clean(req?.path);

    const parts = path.split("/").filter(Boolean);
    if (parts.length < 4 || parts[0] !== "tenants") {
      throw new functions.https.HttpsError("invalid-argument", "TENANT_PATH_REQUIRED");
    }

    const tenantId = safeSegment(parts[1], "tenantId");

    if (!(await canWriteTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_WRITE_DENIED");
    }

    const ref = db.doc(path);
    const before = await ref.get();

    await ref.delete();

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: "DELETE",
      entityType: parts[2] || "unknown",
      entityId: parts[3] || "",
      actorUid: auth.uid,
      actorEmail: auth.email,
      before: before.exists ? before.data() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "tenantDeleteDoc",
    });

    return { ok: true };
  }
);

type WriteActivityLogBody = {
  tenantId?: string;
  userId?: string;
  action?: string;
  page?: string;
  targetType?: string;
  targetId?: string;
  details?: unknown;
  [key: string]: unknown;
};

export const writeActivityLog = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }

      const auth = await getHttpAuthContext(req);
      if (!auth) {
        res.status(401).json({ ok: false, error: "AUTH_REQUIRED" });
        return;
      }

      const body = (req.body || {}) as WriteActivityLogBody;
      const tenantId = safeSegment(String(body.tenantId || ""), "tenantId");

      if (!(await canWriteTenant(auth, tenantId))) {
        res.status(403).json({ ok: false, error: "TENANT_WRITE_DENIED" });
        return;
      }

      const payload = {
        ...body,
        tenantId,
        actorUid: body.actorUid || auth.uid,
        actorEmail: body.actorEmail || auth.email,
        actorDisplayName: body.actorDisplayName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "web",
      };

      await db.collection("tenants").doc(tenantId).collection("activityLogs").add(payload);

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error("writeActivityLog error:", error);

      res.status(500).json({
        ok: false,
        error: error?.message || "Unknown error",
      });
    }
  });
});

type SuggestionPayload = {
  title?: string;
  schoolName?: string;
  schoolEmail?: string;
  notes?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function gmailConfig() {
  const gmailUser = clean(process.env.GMAIL_USER);
  // Supports both the older env name used in this project and the app-password name used by suggestions.ts.
  const gmailPass = clean(process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD);
  return { gmailUser, gmailPass };
}

export const sendSuggestionEmailCallable = functions
  .region("us-central1")
  .https.onCall(async (data: SuggestionPayload, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "AUTH_REQUIRED");
    }

    try {
      const title = String(data?.title || "").trim();
      const schoolName = String(data?.schoolName || "").trim();
      const schoolEmail = String(data?.schoolEmail || "").trim();
      const notes = String(data?.notes || "").trim();

      console.log("sendSuggestionEmailCallable called", {
        title,
        schoolName,
        schoolEmail,
        hasNotes: !!notes,
      });

      if (!title) {
        throw new functions.https.HttpsError("invalid-argument", "عنوان المقترح مطلوب.");
      }

      if (!schoolName) {
        throw new functions.https.HttpsError("invalid-argument", "اسم المدرسة مطلوب.");
      }

      if (!schoolEmail || !isValidEmail(schoolEmail)) {
        throw new functions.https.HttpsError("invalid-argument", "إيميل المدرسة غير صحيح.");
      }

      if (!notes) {
        throw new functions.https.HttpsError("invalid-argument", "الملاحظات والاقتراحات مطلوبة.");
      }

      const { gmailUser, gmailPass } = gmailConfig();

      if (!gmailUser || !gmailPass) {
        throw new functions.https.HttpsError("failed-precondition", "إعدادات Gmail غير موجودة.");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      await transporter.sendMail({
        from: gmailUser,
        to: "3asal2030@gmail.com",
        replyTo: schoolEmail,
        subject: `مقترح تطوير البرنامج - ${title}`,
        text: `
عنوان المقترح: ${title}
اسم المدرسة: ${schoolName}
إيميل المدرسة: ${schoolEmail}

الملاحظات والاقتراحات:
${notes}
        `.trim(),
        html: `
          <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.9;">
            <h2>مقترح جديد لتطوير البرنامج</h2>
            <p><strong>عنوان المقترح:</strong> ${escapeHtml(title)}</p>
            <p><strong>اسم المدرسة:</strong> ${escapeHtml(schoolName)}</p>
            <p><strong>إيميل المدرسة:</strong> ${escapeHtml(schoolEmail)}</p>
            <p><strong>الملاحظات والاقتراحات:</strong></p>
            <div style="white-space: pre-wrap; padding: 12px; background: #f5f5f5; border-radius: 8px;">
              ${escapeHtml(notes)}
            </div>
          </div>
        `,
      });

      return {
        ok: true,
        message: "تم إرسال المقترح بنجاح.",
      };
    } catch (error: any) {
      console.error("sendSuggestionEmailCallable failed:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        error?.message || "فشل إرسال البريد الإلكتروني."
      );
    }
  });


// =====================================================
// Commercial user provisioning
// Creates/updates BOTH:
// 1) allowlist/{email}
// 2) tenants/{tenantId}/members/{uid}
// Also refreshes Firebase Auth custom claims for compatibility.
// =====================================================

type AdminUpsertAllowlistReq = {
  email?: string;
  enabled?: boolean;
  role?: string;
  tenantId?: string;
  governorate?: string;
  name?: string;
  schoolName?: string;
};

function normalizeManagedRole(value: unknown): Role {
  const role = clean(value).toLowerCase();

  if (
    role === "super_admin" ||
    role === "super" ||
    role === "ministry_super" ||
    role === "exam_super" ||
    role === "tenant_admin" ||
    role === "admin" ||
    role === "user"
  ) {
    return role as Role;
  }

  throw new functions.https.HttpsError("invalid-argument", "INVALID_ROLE");
}

function isTenantScopedRole(role: Role) {
  return role === "exam_super" || role === "tenant_admin" || role === "admin" || role === "user";
}

async function getTenantDocOrThrow(tenantId: string) {
  const snap = await db.collection("tenants").doc(tenantId).get();

  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "TENANT_NOT_FOUND");
  }

  return snap;
}


function normalizedTenantKind(data: FirebaseFirestore.DocumentData) {
  const raw = clean(
    data.type ||
      data.tenantType ||
      data.kind ||
      data.category ||
      ""
  ).toLowerCase();

  const hasCenterName = !!clean(data.centerName || data.examCenterName || data.diplomaCenterName);
  const hasSchoolName = !!clean(data.schoolName || data.name);

  if (
    raw.includes("exam") ||
    raw.includes("diploma") ||
    raw.includes("center") ||
    raw.includes("مركز") ||
    raw.includes("دبلوم") ||
    hasCenterName
  ) {
    return "exam_center";
  }

  if (
    raw.includes("school") ||
    raw.includes("مدرس") ||
    hasSchoolName ||
    !raw
  ) {
    return "school";
  }

  return raw;
}

function assertRoleFitsTenant(role: Role, tenantId: string, tenantData: FirebaseFirestore.DocumentData) {
  if (!isTenantScopedRole(role) || !tenantId) return;

  const tenantKind = normalizedTenantKind(tenantData || {});

  // Commercial rule:
  // - School admin roles must be linked to schools only.
  // - Diploma exam-center head role must be linked to diploma/exam centers only.
  // - Legacy roles "admin" and "user" are allowed inside either tenant type for compatibility.
  if (role === "tenant_admin" && tenantKind !== "school") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "TENANT_ADMIN_MUST_BE_LINKED_TO_SCHOOL"
    );
  }

  if (role === "exam_super" && tenantKind !== "exam_center") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "EXAM_SUPER_MUST_BE_LINKED_TO_EXAM_CENTER"
    );
  }
}

async function canManageTargetUser(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  targetRole: Role,
  tenantId: string,
  targetGovernorate: string
) {
  if (auth.isSuperAdmin || auth.isOwner) return true;

  // Ministry-level supervisor can manage all non-owner roles.
  if (auth.role === "ministry_super") {
    return targetRole !== "super_admin";
  }

  // Governorate supervisor commercial permissions:
  // - Can create/update school admins and diploma exam-center admins inside the same governorate.
  // - Can also manage normal tenant users/admins inside the same governorate.
  // - Cannot create owner, platform admin, ministry supervisor, or another governorate supervisor.
  if (auth.isSuperRegional) {
    const allowedTargetRoles: Role[] = ["tenant_admin", "exam_super", "admin", "user"];
    if (!allowedTargetRoles.includes(targetRole)) return false;
    if (!tenantId) return false;

    const tenantGov = await tenantGovernorate(tenantId);
    if (auth.governorate === "الوزارة") return true;

    return clean(tenantGov || targetGovernorate) === clean(auth.governorate);
  }

  return false;
}

async function getOrCreateAuthUserByEmail(email: string, displayName: string) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    return { userRecord: existing, created: false };
  } catch (error: any) {
    if (String(error?.code || "") !== "auth/user-not-found") {
      throw error;
    }

    const created = await admin.auth().createUser({
      email,
      emailVerified: false,
      disabled: false,
      displayName: displayName || undefined,
    });

    return { userRecord: created, created: true };
  }
}

async function setCompatibleClaims(
  uid: string,
  payload: {
    enabled: boolean;
    role: Role;
    tenantId: string;
    governorate: string;
  }
) {
  const userRecord = await admin.auth().getUser(uid);
  const currentClaims = (userRecord.customClaims || {}) as Record<string, unknown>;

  await admin.auth().setCustomUserClaims(uid, {
    ...currentClaims,
    enabled: payload.enabled,
    role: payload.role,
    tenantId: payload.tenantId,
    governorate: payload.governorate || "",
  });
}

export const adminUpsertAllowlist = functions
  .region("us-central1")
  .https.onCall(async (data: AdminUpsertAllowlistReq, context) => {
    const auth = await getAuthContext(context);

    const email = clean(data?.email).toLowerCase();
    if (!email || !isValidEmail(email)) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_EMAIL");
    }

    const role = normalizeManagedRole(data?.role || "user");
    const enabled = data?.enabled !== false;
    const tenantId = clean(data?.tenantId);
    const inputGovernorate = clean(data?.governorate);
    const name = clean(data?.name);
    const schoolName = clean(data?.schoolName);

    if (isTenantScopedRole(role) && !tenantId) {
      throw new functions.https.HttpsError("invalid-argument", "TENANT_ID_REQUIRED");
    }

    let tenantData: FirebaseFirestore.DocumentData = {};
    let effectiveGovernorate = inputGovernorate;

    if (tenantId) {
      const tenantSnap = await getTenantDocOrThrow(tenantId);
      tenantData = tenantSnap.data() || {};

      if (!effectiveGovernorate) {
        effectiveGovernorate = clean(tenantData.governorate || "");
      }

      assertRoleFitsTenant(role, tenantId, tenantData);
    }

    if (!(await canManageTargetUser(auth, role, tenantId, effectiveGovernorate))) {
      throw new functions.https.HttpsError("permission-denied", "USER_MANAGEMENT_DENIED");
    }

    const oldAllowSnap = await db.collection("allowlist").doc(email).get();
    const oldAllow = oldAllowSnap.exists ? oldAllowSnap.data() || {} : {};
    const oldTenantId = clean(oldAllow.tenantId);

    const displayName = name || clean(oldAllow.name) || email;
    const { userRecord, created } = await getOrCreateAuthUserByEmail(email, displayName);

    const now = admin.firestore.FieldValue.serverTimestamp();

    const allowPayload = {
      email,
      enabled,
      role,
      tenantId: tenantId || "system",
      governorate: effectiveGovernorate || "",
      name: displayName,
      schoolName: schoolName || clean(tenantData.name || tenantData.schoolName || ""),
      tenantName: schoolName || clean(tenantData.name || tenantData.schoolName || ""),
      updatedAt: now,
      updatedBy: auth.email || auth.uid || "",
      ...(oldAllowSnap.exists ? {} : { createdAt: now, createdBy: auth.email || auth.uid || "" }),
    };

    const batch = db.batch();

    batch.set(db.collection("allowlist").doc(email), allowPayload, { merge: true });

    // Remove old tenant membership if user is transferred to another tenant.
    if (oldTenantId && oldTenantId !== tenantId) {
      batch.delete(
        db.collection("tenants")
          .doc(oldTenantId)
          .collection("members")
          .doc(userRecord.uid)
      );
    }

    if (tenantId && isTenantScopedRole(role)) {
      const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(userRecord.uid);

      batch.set(
        memberRef,
        {
          uid: userRecord.uid,
          email,
          enabled,
          role,
          tenantId,
          governorate: effectiveGovernorate || "",
          name: displayName,
          schoolName: schoolName || clean(tenantData.name || tenantData.schoolName || ""),
          updatedAt: now,
          updatedByUid: auth.uid,
          updatedByEmail: auth.email || "",
          ...(created ? { createdAt: now, createdByUid: auth.uid, createdByEmail: auth.email || "" } : {}),
        },
        { merge: true }
      );
    }

    await batch.commit();

    await setCompatibleClaims(userRecord.uid, {
      enabled,
      role,
      tenantId: tenantId || "system",
      governorate: effectiveGovernorate || "",
    });

    if (tenantId) {
      await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
        tenantId,
        action: "USER_UPSERT",
        entityType: "member",
        entityId: userRecord.uid,
        actorUid: auth.uid,
        actorEmail: auth.email,
        targetEmail: email,
        targetUid: userRecord.uid,
        role,
        enabled,
        createdAuthUser: created,
        createdAt: now,
        source: "adminUpsertAllowlist",
      });
    }

    return {
      ok: true,
      uid: userRecord.uid,
      email,
      role,
      tenantId: tenantId || "system",
      createdAuthUser: created,
    };
  });


type AdminListManagedUsersReq = {
  governorate?: string;
  limit?: number;
};

type AdminListManagedTenantsReq = {
  governorate?: string;
  limit?: number;
};

function canViewGovernorate(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  requestedGovernorate: string
) {
  if (auth.isSuperAdmin || auth.isOwner) return true;
  if (auth.role === "ministry_super") return true;
  if (auth.isSuperRegional) {
    return !requestedGovernorate || clean(requestedGovernorate) === clean(auth.governorate);
  }
  return false;
}

export const adminListManagedUsers = functions
  .region("us-central1")
  .https.onCall(async (data: AdminListManagedUsersReq, context) => {
    const auth = await getAuthContext(context);
    const requestedGovernorate = clean(data?.governorate);
    const max = Math.min(Math.max(Number(data?.limit || 500), 1), 1000);

    if (!canViewGovernorate(auth, requestedGovernorate)) {
      throw new functions.https.HttpsError("permission-denied", "GOVERNORATE_ACCESS_DENIED");
    }

    let q = db.collection("allowlist") as FirebaseFirestore.Query;

    if (!(auth.isSuperAdmin || auth.isOwner || auth.role === "ministry_super")) {
      q = q.where("governorate", "==", auth.governorate || "");
    } else if (requestedGovernorate) {
      q = q.where("governorate", "==", requestedGovernorate);
    }

    const snap = await q.limit(max).get();
    const items = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        email: clean(x.email || d.id),
        enabled: x.enabled === true,
        role: clean(x.role || "user"),
        tenantId: clean(x.tenantId || ""),
        governorate: clean(x.governorate || ""),
        name: clean(x.name || ""),
        schoolName: clean(x.schoolName || x.tenantName || ""),
        tenantName: clean(x.tenantName || x.schoolName || ""),
        updatedAt: x.updatedAt || null,
      };
    });

    return { items };
  });

export const adminListManagedTenants = functions
  .region("us-central1")
  .https.onCall(async (data: AdminListManagedTenantsReq, context) => {
    const auth = await getAuthContext(context);
    const requestedGovernorate = clean(data?.governorate);
    const max = Math.min(Math.max(Number(data?.limit || 500), 1), 1000);

    if (!canViewGovernorate(auth, requestedGovernorate)) {
      throw new functions.https.HttpsError("permission-denied", "GOVERNORATE_ACCESS_DENIED");
    }

    let q = db.collection("tenants") as FirebaseFirestore.Query;

    if (!(auth.isSuperAdmin || auth.isOwner || auth.role === "ministry_super")) {
      q = q.where("governorate", "==", auth.governorate || "");
    } else if (requestedGovernorate) {
      q = q.where("governorate", "==", requestedGovernorate);
    }

    const snap = await q.limit(max).get();
    const items = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        tenantId: d.id,
        name: clean(x.name || x.schoolName || x.centerName || d.id),
        schoolName: clean(x.schoolName || x.name || ""),
        centerName: clean(x.centerName || ""),
        type: normalizedTenantKind(x),
        governorate: clean(x.governorate || ""),
        enabled: x.enabled !== false,
        updatedAt: x.updatedAt || null,
      };
    });

    return { items };
  });

type AdminDeleteAllowlistReq = {
  email?: string;
};

export const adminDeleteAllowlist = functions
  .region("us-central1")
  .https.onCall(async (data: AdminDeleteAllowlistReq, context) => {
    const auth = await getAuthContext(context);

    const email = clean(data?.email).toLowerCase();
    if (!email || !isValidEmail(email)) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_EMAIL");
    }

    const allowSnap = await db.collection("allowlist").doc(email).get();
    if (!allowSnap.exists) {
      return { ok: true, deleted: false };
    }

    const allow = allowSnap.data() || {};
    const tenantId = clean(allow.tenantId);
    const role = normalizeManagedRole(allow.role || "user");
    const governorate = clean(allow.governorate);

    if (!(await canManageTargetUser(auth, role, tenantId, governorate))) {
      throw new functions.https.HttpsError("permission-denied", "USER_DELETE_DENIED");
    }

    let uid = "";
    try {
      const target = await admin.auth().getUserByEmail(email);
      uid = target.uid;
    } catch (error: any) {
      if (String(error?.code || "") !== "auth/user-not-found") {
        throw error;
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.delete(db.collection("allowlist").doc(email));

    if (tenantId && uid) {
      batch.delete(db.collection("tenants").doc(tenantId).collection("members").doc(uid));
    }

    await batch.commit();

    if (uid) {
      await setCompatibleClaims(uid, {
        enabled: false,
        role,
        tenantId: tenantId || "system",
        governorate,
      });
    }

    if (tenantId) {
      await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
        tenantId,
        action: "USER_DELETE",
        entityType: "member",
        entityId: uid || email,
        actorUid: auth.uid,
        actorEmail: auth.email,
        targetEmail: email,
        targetUid: uid || "",
        role,
        createdAt: now,
        source: "adminDeleteAllowlist",
      });
    }

    return { ok: true, deleted: true, uid };
  });

// =====================================================
// Phone change request email
// Sends a real email to the requester with a secure change link.
// A copy is sent to the platform owner for audit/visibility.
// Path: tenants/{tenantId}/phoneChangeRequests/{requestId}
// =====================================================

function maskEmailForLog(email: string) {
  const value = clean(email).toLowerCase();
  const [name, domain] = value.split("@");
  if (!name || !domain) return "";
  if (name.length <= 2) return `${name[0] || "*"}***@${domain}`;
  return `${name[0]}${"*".repeat(Math.max(3, name.length - 2))}${name[name.length - 1]}@${domain}`;
}

function getRequesterEmail(data: FirebaseFirestore.DocumentData) {
  return clean(
    data.requesterEmail ||
      data.requestEmail ||
      data.userEmail ||
      data.email ||
      data.schoolEmail ||
      data.centerEmail ||
      ""
  ).toLowerCase();
}

function getPhoneChangeBaseUrl() {
  return clean(
    process.env.APP_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.VITE_APP_BASE_URL ||
      "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}


function getGovernorateFromData(data: FirebaseFirestore.DocumentData) {
  return clean(
    data.governorate ||
      data.governorateAr ||
      data.tenantGovernorate ||
      data.regionAr ||
      data.scopeGovernorate ||
      data.gov ||
      ""
  );
}

function isGovernorateSuperRoleValue(role: string) {
  const value = clean(role);
  return [
    "super",
    "super_regional",
    "regional_super",
    "governorate_super",
    "governorate-super",
    "super_governorate",
    "governorate_supervisor",
    "province_super",
    "سوبر المحافظة",
    "سوبر المحافظات",
    "مشرف المحافظة",
    "مشرف المحافظات",
    "مشرف نطاق",
  ].includes(value);
}

async function getGovernorateSuperEmails(governorate: string, excludeEmails: string[] = []) {
  const targetGovernorate = clean(governorate);
  if (!targetGovernorate) return [] as string[];

  const excluded = new Set(
    excludeEmails
      .map((email) => clean(email).toLowerCase())
      .filter(Boolean)
  );

  const result: string[] = [];
  const seen = new Set<string>();

  const snap = await db.collection("allowlist").get();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const enabled = data.enabled === true || data.active === true;
    const role = clean(data.role || data.originalRole || "");
    const docGovernorate = getGovernorateFromData(data);
    const email = clean(data.email || doc.id).toLowerCase();

    if (!enabled) return;
    if (!isGovernorateSuperRoleValue(role)) return;
    if (!email || !isValidEmail(email)) return;
    if (docGovernorate !== targetGovernorate) return;
    if (excluded.has(email)) return;
    if (seen.has(email)) return;

    seen.add(email);
    result.push(email);
  });

  return result;
}

export const sendPhoneChangeRequestEmail = functions
  .region("us-central1")
  .firestore.document("tenants/{tenantId}/phoneChangeRequests/{requestId}")
  .onCreate(async (snap, context) => {
    const tenantId = clean(context.params.tenantId);
    const requestId = clean(context.params.requestId);
    const data = snap.data() || {};

    const requesterEmail = getRequesterEmail(data);
    const platformOwnerEmail = "3asal2030@gmail.com";

    if (!tenantId || !requestId) {
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailError: "TENANT_OR_REQUEST_ID_MISSING",
          emailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    if (!requesterEmail || !isValidEmail(requesterEmail)) {
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailError: "REQUESTER_EMAIL_MISSING_OR_INVALID",
          emailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const { gmailUser, gmailPass } = gmailConfig();
    if (!gmailUser || !gmailPass) {
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailError: "GMAIL_CONFIG_MISSING",
          emailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const rawToken = makeSecureToken();
    const tokenHash = sha256(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
    const baseUrl = getPhoneChangeBaseUrl();
    const changeUrl = `${baseUrl}/t/${encodeURIComponent(tenantId)}/change-phone?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(rawToken)}`;

    const schoolOrCenterName = clean(
      data.tenantName ||
        data.centerName ||
        data.schoolName ||
        data.entityName ||
        data.name ||
        tenantId
    );
    const governorate = getGovernorateFromData(data);
    const maskedPhone = clean(data.maskedPhone || data.phoneMasked || data.currentPhoneMasked || "");
    const page = clean(data.page || "");
    const requestType = clean(data.requestType || "phone_change");
    const status = clean(data.status || "pending");
    const createdAtISO = clean(data.createdAtISO || now.toISOString());
    const governorateSuperEmails = await getGovernorateSuperEmails(governorate, [
      requesterEmail,
      platformOwnerEmail,
    ]);
    const ccEmails = Array.from(new Set([
      platformOwnerEmail,
      ...governorateSuperEmails,
    ].map((email) => clean(email).toLowerCase()).filter(Boolean)));

    const subject = `طلب تغيير رقم الهاتف - ${schoolOrCenterName}`;
    const textBody = `
تم تسجيل طلب تغيير رقم هاتف في نظام إدارة الامتحانات المطور.

المدرسة / المركز: ${schoolOrCenterName}
معرف المدرسة / المركز: ${tenantId}
المحافظة: ${governorate || "غير محددة"}
البريد الطالب للتغيير: ${requesterEmail}
رقم الهاتف الحالي: ${maskedPhone || "غير متوفر"}
نوع الطلب: ${requestType}
حالة الطلب: ${status}
الصفحة: ${page || "غير محددة"}
رقم الطلب: ${requestId}
تاريخ الطلب: ${createdAtISO}
نسخة إلى: ${ccEmails.length ? ccEmails.join(", ") : "لا يوجد"}

رابط تغيير رقم الهاتف:
${changeUrl}

صلاحية الرابط: 30 دقيقة فقط.
إذا لم تطلب تغيير رقم الهاتف، تجاهل هذه الرسالة وأبلغ مسؤول النظام.
    `.trim();

    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.9; color: #111;">
        <h2 style="margin: 0 0 16px;">طلب تغيير رقم الهاتف</h2>
        <p>تم تسجيل طلب تغيير رقم هاتف جديد في نظام إدارة الامتحانات المطور.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 760px; border: 1px solid #ddd;">
          <tbody>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">المدرسة / المركز</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(schoolOrCenterName)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">معرف المدرسة / المركز</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(tenantId)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">المحافظة</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(governorate || "غير محددة")}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">البريد الطالب للتغيير</th><td style="border:1px solid #ddd; padding:10px;"><a href="mailto:${escapeHtml(requesterEmail)}">${escapeHtml(requesterEmail)}</a></td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">رقم الهاتف الحالي</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(maskedPhone || "غير متوفر")}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">نوع الطلب</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(requestType)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">حالة الطلب</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(status)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">الصفحة</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(page || "غير محددة")}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">رقم الطلب</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(requestId)}</td></tr>
            <tr><th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7;">تاريخ الطلب</th><td style="border:1px solid #ddd; padding:10px;">${escapeHtml(createdAtISO)}</td></tr>
            <tr>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#f7f7f7; color:#111; font-weight:bold;">رابط تغيير رقم الهاتف</th>
              <td style="border:1px solid #ddd; padding:12px; color:#111; font-weight:bold;">
                <a href="${escapeHtml(changeUrl)}" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:bold; border:1px solid #0b5f59;">اضغط هنا لتغيير رقم الهاتف</a>
                <div style="margin-top:10px; font-size:12px; color:#111; font-weight:bold; word-break:break-all; direction:ltr; text-align:left;">${escapeHtml(changeUrl)}</div>
              </td>
            </tr>
            <tr>
              <th style="text-align:right; border:1px solid #ddd; padding:10px; background:#fff7ed; color:#7f1d1d; font-weight:bold;">صلاحية الرابط</th>
              <td style="border:1px solid #ddd; padding:10px; color:#7f1d1d; font-weight:bold;">30 دقيقة فقط، ولا يمكن استخدام الرابط إلا مرة واحدة.</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 16px; color:#7f1d1d;"><strong>صلاحية الرابط:</strong> 30 دقيقة فقط.</p>
        <p style="font-size: 13px; color:#555;">إذا لم تطلب تغيير رقم الهاتف، تجاهل هذه الرسالة وأبلغ مسؤول النظام.</p>
      </div>
    `;

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const info = await transporter.sendMail({
        from: gmailUser,
        to: requesterEmail,
        cc: ccEmails,
        replyTo: platformOwnerEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });

      await snap.ref.set(
        {
          emailStatus: "sent",
          emailTo: requesterEmail,
          emailCc: ccEmails,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          emailMessageId: clean((info as any)?.messageId || ""),
          changeUrl,
          changeTokenHash: tokenHash,
          changeTokenCreatedAtISO: now.toISOString(),
          changeTokenExpiresAtISO: expiresAt.toISOString(),
          changeTokenUsedAtISO: "",
          maskedRequesterEmail: maskEmailForLog(requesterEmail),
        },
        { merge: true }
      );
    } catch (error: any) {
      console.error("sendPhoneChangeRequestEmail failed:", error);
      await snap.ref.set(
        {
          emailStatus: "failed",
          emailTo: requesterEmail,
          emailCc: ccEmails,
          emailError: clean(error?.message || "UNKNOWN_EMAIL_ERROR"),
          emailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          maskedRequesterEmail: maskEmailForLog(requesterEmail),
        },
        { merge: true }
      );
    }
  });

// =====================================================
// Complete phone change request
// Validates the email link token server-side, updates tenant settings,
// marks the request completed, and prevents reuse.
// =====================================================

type CompletePhoneChangeReq = {
  tenantId?: string;
  requestId?: string;
  token?: string;
  newPhone?: string;
};

function phoneDigitsOnly(value: unknown) {
  return clean(value).replace(/[^0-9]/g, "");
}

function maskPhoneFirstLastServer(value: string) {
  const digits = phoneDigitsOnly(value);
  if (!digits) return "";
  if (digits.length === 1) return digits;
  if (digits.length === 2) return `${digits[0]}x`;
  return `${digits[0]}${"x".repeat(Math.max(1, digits.length - 2))}${digits[digits.length - 1]}`;
}
function normalizePhoneChangeSourcePage(value: unknown) {
  const page = clean(value).toLowerCase();
  if (page === "settings1" || page === "school" || page === "school_settings") return "Settings1";
  return "Settings12";
}

function phoneChangeReturnPath(tenantId: string, sourcePage: string) {
  return sourcePage === "Settings1"
    ? `/t/${encodeURIComponent(tenantId)}/settings1`
    : `/t/${encodeURIComponent(tenantId)}/settings12`;
}


async function updateExistingTenantPhoneDocs(tenantId: string, sourcePage: string, payload: Record<string, any>) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const updatePayload = {
    ...payload,
    phoneLocked: true,
    phoneUpdatedAt: now,
    phoneUpdatedAtISO: new Date().toISOString(),
    updatedAt: now,
    updatedAtISO: new Date().toISOString(),
  };

  // Always maintain the current tenant meta/config copy.
  // The tenant itself is already separated by /t/:tenantId, so this does not mix school and diploma tenants.
  await tenantRef.collection("meta").doc("config").set(updatePayload, { merge: true });

  // Keep school and diploma settings documents separated by the request source page.
  const settingsDocIds = sourcePage === "Settings1"
    ? ["school", "schoolSettings", "config", "default", "settings"]
    : ["diplomaExamCenter", "examCenter", "config", "default", "settings"];

  const refs = settingsDocIds.map((id) => tenantRef.collection("settings").doc(id));
  const snaps = await Promise.all(refs.map((ref) => ref.get()));

  const batch = db.batch();
  snaps.forEach((snap, index) => {
    if (snap.exists) {
      batch.set(refs[index], updatePayload, { merge: true });
    }
  });

  await batch.commit();
}

export const completePhoneChangeRequest = functions
  .region("us-central1")
  .https.onCall(async (data: CompletePhoneChangeReq, context) => {
    const auth = await getAuthContext(context);

    const tenantId = safeSegment(String(data?.tenantId || ""), "tenantId");
    const requestId = safeSegment(String(data?.requestId || ""), "requestId");
    const token = clean(data?.token || "");
    const newPhone = phoneDigitsOnly(data?.newPhone || "");

    if (!token) {
      throw new functions.https.HttpsError("invalid-argument", "TOKEN_REQUIRED");
    }

    if (!newPhone || newPhone.length < 6 || newPhone.length > 15) {
      throw new functions.https.HttpsError("invalid-argument", "INVALID_PHONE");
    }

    if (!(await canWriteTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_WRITE_DENIED");
    }

    const requestRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("phoneChangeRequests")
      .doc(requestId);

    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      throw new functions.https.HttpsError("not-found", "REQUEST_NOT_FOUND");
    }

    const requestData = requestSnap.data() || {};
    const sourcePage = normalizePhoneChangeSourcePage(requestData.page || requestData.sourcePage || requestData.originPage);
    const returnPath = phoneChangeReturnPath(tenantId, sourcePage);
    const requesterEmail = getRequesterEmail(requestData);
    const authEmailLower = clean(auth.email).toLowerCase();

    if (requesterEmail && requesterEmail !== authEmailLower && !auth.isSuperAdmin) {
      throw new functions.https.HttpsError("permission-denied", "AUTH_EMAIL_MISMATCH");
    }

    const status = clean(requestData.status || "pending").toLowerCase();
    if (status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "REQUEST_ALREADY_COMPLETED");
    }

    if (clean(requestData.changeTokenUsedAtISO)) {
      throw new functions.https.HttpsError("failed-precondition", "REQUEST_ALREADY_COMPLETED");
    }

    const expectedHash = clean(requestData.changeTokenHash);
    if (!expectedHash || sha256(token) !== expectedHash) {
      throw new functions.https.HttpsError("permission-denied", "TOKEN_INVALID");
    }

    const expiresAtISO = clean(requestData.changeTokenExpiresAtISO);
    if (expiresAtISO) {
      const expiresAt = Date.parse(expiresAtISO);
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        throw new functions.https.HttpsError("deadline-exceeded", "TOKEN_EXPIRED");
      }
    }

    const maskedPhone = maskPhoneFirstLastServer(newPhone);
    const nowISO = new Date().toISOString();

    await updateExistingTenantPhoneDocs(tenantId, sourcePage, {
      phone: newPhone,
      phoneMasked: maskedPhone,
      maskedPhone,
      phoneChangeRequestId: requestId,
      phoneChangeCompletedAtISO: nowISO,
    });

    await requestRef.set(
      {
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAtISO: nowISO,
        completedBy: auth.email || auth.uid || "",
        newPhoneMasked: maskedPhone,
        sourcePage,
        returnPath,
        changeTokenUsedAtISO: nowISO,
      },
      { merge: true }
    );

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: "PHONE_CHANGE_COMPLETED",
      entityType: "phoneChangeRequest",
      entityId: requestId,
      actorUid: auth.uid,
      actorEmail: auth.email,
      newPhoneMasked: maskedPhone,
      sourcePage,
      returnPath,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtISO: nowISO,
      source: "completePhoneChangeRequest",
    });

    return {
      ok: true,
      maskedPhone,
      sourcePage,
      returnPath,
      tenantKind: sourcePage === "Settings1" ? "school" : "diploma",
      message: "تم تغيير رقم الهاتف بنجاح.",
    };
  });

// =====================================================
// Control12 email access code gate
// Sends a one-time 6-digit code to the authenticated user's email.
// The code is stored hashed and expires quickly.
// =====================================================

function controlAccessHash(value: string) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function controlAccessDocRef(tenantId: string, uid: string) {
  return db
    .collection("tenants")
    .doc(tenantId)
    .collection("controlAccessCodes")
    .doc(uid);
}

const CONTROL_ACCESS_MAX_ATTEMPTS = 5;
const CONTROL_ACCESS_LOCK_MINUTES = 5;

function controlAccessLockUntilTimestamp() {
  return admin.firestore.Timestamp.fromMillis(Date.now() + CONTROL_ACCESS_LOCK_MINUTES * 60 * 1000);
}

function timestampToMillis(value: unknown) {
  if (value && typeof (value as admin.firestore.Timestamp).toMillis === "function") {
    return (value as admin.firestore.Timestamp).toMillis();
  }
  return 0;
}

export const sendControl12AccessCodeEmail = functions
  .region("us-central1")
  .https.onCall(async (data: { tenantId?: string }, context) => {
    const auth = await getAuthContext(context);
    const tenantId = safeSegment(String(data?.tenantId || ""), "tenantId");

    if (!(await canReadTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_ACCESS_DENIED");
    }

    if (!auth.email || !isValidEmail(auth.email)) {
      throw new functions.https.HttpsError("failed-precondition", "لا يوجد بريد إلكتروني صالح للحساب الحالي.");
    }

    const { gmailUser, gmailPass } = gmailConfig();
    if (!gmailUser || !gmailPass) {
      throw new functions.https.HttpsError("failed-precondition", "إعدادات Gmail غير موجودة.");
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = controlAccessHash(`${tenantId}:${auth.uid}:${code}`);

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};

    const metaSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("meta")
      .doc("config")
      .get();
    const metaData = metaSnap.exists ? metaSnap.data() || {} : {};

    const centerName = clean(
      metaData.schoolNameAr ||
        metaData.centerNameAr ||
        metaData.tenantName ||
        tenantData.schoolName ||
        tenantData.tenantName ||
        tenantId
    );

    const accessRef = controlAccessDocRef(tenantId, auth.uid);
    const existingAccessSnap = await accessRef.get();
    const existingAccess = existingAccessSnap.exists ? existingAccessSnap.data() || {} : {};
    const existingLockedUntilMillis = timestampToMillis(existingAccess.lockedUntil);

    if (existingLockedUntilMillis > Date.now()) {
      const secondsLeft = Math.max(Math.ceil((existingLockedUntilMillis - Date.now()) / 1000), 1);
      const minutesLeft = Math.ceil(secondsLeft / 60);
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${minutesLeft} دقيقة.`,
        {
          reason: "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS",
          retryAfterSeconds: secondsLeft,
          lockedUntilISO: new Date(existingLockedUntilMillis).toISOString(),
        }
      );
    }

    await accessRef.set(
      {
        tenantId,
        uid: auth.uid,
        email: auth.email,
        page: "Control12",
        codeHash,
        attempts: 0,
        lockedUntil: null,
        lockedAt: null,
        lockedReason: null,
        used: false,
        createdAt: now,
        expiresAt,
        lastSentAt: now,
      },
      { merge: true }
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    const subject = `رمز الدخول إلى صفحة الكنترول - ${centerName}`;
    const textBody = `
رمز الدخول إلى صفحة الكنترول

المركز: ${centerName}
معرف المركز: ${tenantId}

رمز الدخول:
${code}

صلاحية الرمز 10 دقائق فقط.
إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.
    `.trim();

    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; color:#000000; font-weight:700; line-height:1.9;">
        <h2 style="color:#000000;font-weight:900;">رمز الدخول إلى صفحة الكنترول</h2>
        <table style="width:100%;border-collapse:collapse;color:#000000;font-weight:700;">
          <tr>
            <td style="border:1px solid #ddd;padding:12px;background:#f8f8f8;font-weight:900;">المركز</td>
            <td style="border:1px solid #ddd;padding:12px;">${escapeHtml(centerName)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px;background:#f8f8f8;font-weight:900;">معرف المركز</td>
            <td style="border:1px solid #ddd;padding:12px;">${escapeHtml(tenantId)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px;background:#f8f8f8;font-weight:900;">رمز الدخول</td>
            <td style="border:1px solid #ddd;padding:12px;font-size:28px;font-weight:900;letter-spacing:5px;color:#000000;">${code}</td>
          </tr>
        </table>
        <p style="color:#000000;font-weight:900;margin-top:18px;">صلاحية الرمز 10 دقائق فقط، ولا يستخدم إلا مرة واحدة.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: gmailUser,
      to: auth.email,
      cc: "3asal2030@gmail.com",
      subject,
      text: textBody,
      html: htmlBody,
    });

    await controlAccessDocRef(tenantId, auth.uid).set(
      {
        emailStatus: "sent",
        emailMessageId: clean(info.messageId),
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      ok: true,
      message: "تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.",
      expiresInMinutes: 10,
    };
  });

export const verifyControl12AccessCode = functions
  .region("us-central1")
  .https.onCall(async (data: { tenantId?: string; code?: string }, context) => {
    const auth = await getAuthContext(context);
    const tenantId = safeSegment(String(data?.tenantId || ""), "tenantId");
    const code = clean(data?.code || "").replace(/\D/g, "");

    if (!(await canReadTenant(auth, tenantId))) {
      throw new functions.https.HttpsError("permission-denied", "TENANT_ACCESS_DENIED");
    }

    if (!/^\d{6}$/.test(code)) {
      throw new functions.https.HttpsError("invalid-argument", "رمز الدخول يجب أن يتكون من 6 أرقام.");
    }

    const ref = controlAccessDocRef(tenantId, auth.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "لم يتم العثور على رمز دخول نشط. أعد إرسال الرمز.");
    }

    const record = snap.data() || {};
    const attempts = Number(record.attempts || 0);
    const expiresAt = record.expiresAt as admin.firestore.Timestamp | undefined;
    const used = record.used === true;
    const lockedUntilMillis = timestampToMillis(record.lockedUntil);

    if (lockedUntilMillis > Date.now()) {
      const minutesLeft = Math.ceil((lockedUntilMillis - Date.now()) / 60000);
      const secondsLeft = Math.max(Math.ceil((lockedUntilMillis - Date.now()) / 1000), 1);
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `تم إيقاف التحقق مؤقتًا بسبب إدخال رمز خاطئ عدة مرات. حاول بعد ${minutesLeft} دقيقة.`,
        {
          reason: "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS",
          retryAfterSeconds: secondsLeft,
          lockedUntilISO: new Date(lockedUntilMillis).toISOString(),
        }
      );
    }

    if (used) {
      throw new functions.https.HttpsError("failed-precondition", "تم استخدام هذا الرمز سابقًا.");
    }

    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      await ref.set(
        {
          expired: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new functions.https.HttpsError("deadline-exceeded", "انتهت صلاحية الرمز. أعد إرسال رمز جديد.");
    }

    if (attempts >= CONTROL_ACCESS_MAX_ATTEMPTS) {
      const lockedUntil = controlAccessLockUntilTimestamp();
      await ref.set(
        {
          lockedAt: admin.firestore.FieldValue.serverTimestamp(),
          lockedUntil,
          lockedReason: "too_many_failed_attempts",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const lockedUntilMillis = timestampToMillis(lockedUntil);
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${CONTROL_ACCESS_LOCK_MINUTES} دقائق.`,
        {
          reason: "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS",
          retryAfterSeconds: CONTROL_ACCESS_LOCK_MINUTES * 60,
          lockedUntilISO: new Date(lockedUntilMillis).toISOString(),
        }
      );
    }

    const expectedHash = clean(record.codeHash);
    const receivedHash = controlAccessHash(`${tenantId}:${auth.uid}:${code}`);

    if (!expectedHash || expectedHash !== receivedHash) {
      const nextAttempts = attempts + 1;
      const shouldLock = nextAttempts >= CONTROL_ACCESS_MAX_ATTEMPTS;
      const lockedUntil = shouldLock ? controlAccessLockUntilTimestamp() : null;

      await ref.set(
        {
          attempts: nextAttempts,
          lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(shouldLock
            ? {
                lockedAt: admin.firestore.FieldValue.serverTimestamp(),
                lockedUntil,
                lockedReason: "too_many_failed_attempts",
              }
            : {}),
        },
        { merge: true }
      );

      if (shouldLock) {
        await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
          tenantId,
          action: "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS",
          entityType: "controlAccess",
          entityId: auth.uid,
          actorUid: auth.uid,
          actorEmail: auth.email,
          attempts: nextAttempts,
          lockedMinutes: CONTROL_ACCESS_LOCK_MINUTES,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: "verifyControl12AccessCode",
        });

        const lockedUntilMillis = timestampToMillis(lockedUntil);
        throw new functions.https.HttpsError(
          "resource-exhausted",
          `تم إيقاف التحقق مؤقتًا بسبب إدخال رمز خاطئ ${CONTROL_ACCESS_MAX_ATTEMPTS} مرات. حاول بعد ${CONTROL_ACCESS_LOCK_MINUTES} دقيقة أو أعد إرسال رمز جديد لاحقًا.`,
          {
            reason: "EMAIL_CODE_LOCKED_TOO_MANY_FAILED_ATTEMPTS",
            retryAfterSeconds: CONTROL_ACCESS_LOCK_MINUTES * 60,
            lockedUntilISO: new Date(lockedUntilMillis).toISOString(),
          }
        );
      }

      const remainingAttempts = Math.max(CONTROL_ACCESS_MAX_ATTEMPTS - nextAttempts, 0);
      throw new functions.https.HttpsError(
        "permission-denied",
        `رمز الدخول غير صحيح. المحاولات المتبقية: ${remainingAttempts}.`
      );
    }

    await ref.set(
      {
        used: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: 0,
        lockedUntil: null,
        lockedAt: null,
        lockedReason: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection("tenants").doc(tenantId).collection("activityLogs").add({
      tenantId,
      action: "CONTROL12_EMAIL_CODE_VERIFIED",
      entityType: "controlAccess",
      entityId: auth.uid,
      actorUid: auth.uid,
      actorEmail: auth.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "verifyControl12AccessCode",
    });

    return {
      ok: true,
      message: "تم التحقق من رمز الدخول بنجاح.",
    };
  });

