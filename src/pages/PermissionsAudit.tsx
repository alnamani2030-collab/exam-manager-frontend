import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD = "#c9a227";
const BG = "linear-gradient(180deg, #f6f0df 0%, #eee5ce 100%)";
const CARD = "#fffaf0";

type AuditRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  governorate: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
  enabled: boolean;
  source: string;
  scopeStatus: "inside" | "outside" | "unknown";
};

type TenantInfo = {
  id: string;
  name: string;
  governorate: string;
  tenantType: string;
};

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sameGovernorate(a: unknown, b: unknown) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function getRole(auth: any) {
  return String(
    auth?.effectiveRole ||
      auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getGovernorateFromAny(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.scopeGovernorate ??
          item?.gov ??
          "";
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function getNameFromAny(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      item?.name ??
      item?.userName ??
      item?.displayName ??
      item?.schoolName ??
      item?.schoolNameAr ??
      item?.centerNameAr ??
      "";
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function getTenantName(data: any) {
  return String(
    data?.schoolNameAr ||
      data?.centerNameAr ||
      data?.schoolName ||
      data?.name ||
      data?.tenantName ||
      ""
  ).trim();
}

function getTenantType(data: any) {
  const raw = String(
    data?.tenantType ||
      data?.type ||
      data?.entityType ||
      data?.kind ||
      ""
  )
    .trim()
    .toLowerCase();

  if (
    data?.isExamCenter === true ||
    data?.isDiplomaCenter === true ||
    ["exam_center", "exam-center", "diploma_center", "diploma-center"].includes(raw)
  ) {
    return "exam_center";
  }
  if (raw) return raw;
  return "school";
}


const GOVERNORATE_FIELD_CANDIDATES = [
  "governorate",
  "tenantGovernorate",
  "regionAr",
  "governorateAr",
  "scopeGovernorate",
  "gov",
];

const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isOwnerRole(role: string) {
  return ["super_admin", "platform_owner", "owner", "مالك المنصة"].includes(role);
}

function isGovernorateSuperRole(role: string) {
  return ["super", "governorate_super", "governorate-super", "سوبر المحافظة", "مشرف المحافظة"].includes(role);
}

function isExamRole(role: string, tenant?: TenantInfo) {
  const r = normalizeText(role);
  return (
    tenant?.tenantType === "exam_center" ||
    [
      "exam_super",
      "exam-center-admin",
      "exam_center_admin",
      "diploma_center_admin",
      "diploma_super",
      "center_admin",
      "control_admin",
      "distribution_super",
      "سوبر الامتحانات",
      "مسؤول مركز الدبلوم",
    ].some((x) => normalizeText(x) === r)
  );
}

function roleLabel(role: string) {
  const r = normalizeText(role);
  if (["super_admin", "platform_owner", "owner"].includes(r)) return "مالك المنصة";
  if (["super", "governorate_super", "governorate-super", "سوبر المحافظة", "مشرف المحافظة"].includes(r)) return "مشرف المحافظة";
  if (["exam_super", "سوبر الامتحانات"].includes(r)) return "سوبر الامتحانات";
  if (["exam_center_admin", "diploma_center_admin", "center_admin", "control_admin", "distribution_super"].includes(r)) return "مسؤول مركز دبلوم";
  if (["school_admin", "school-admin", "tenant_admin", "admin", "أدمن المدرسة", "ادمن المدرسة", "مدير المدرسة"].includes(r)) return "أدمن مدرسة";
  return role || "مستخدم";
}

function setReadOnlyView(tenantId: string) {
  const expiresAt = String(Date.now() + 6 * 60 * 60 * 1000);
  const entries: Array<[string, string]> = [
    ["governorateSuperReadOnly", "true"],
    ["viewAsReadOnly", "true"],
    ["readOnly", "true"],
    ["governorateSuperViewTenantId", tenantId],
    ["viewAsTenantId", tenantId],
    ["effectiveTenantId", tenantId],
    ["selectedTenantId", tenantId],
    ["governorateSuperViewExpiresAt", expiresAt],
  ];

  for (const [key, value] of entries) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function clearReadOnlyView() {
  const keys = [
    "governorateSuperReadOnly",
    "viewAsReadOnly",
    "readOnly",
    "governorateSuperViewTenantId",
    "viewAsTenantId",
    "governorateSuperViewExpiresAt",
  ];
  for (const key of keys) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export default function PermissionsAudit() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const role = getRole(auth);
  const isOwner = isOwnerRole(role);
  const isGovSuper = isGovernorateSuperRole(role);
  const currentGovernorate = getGovernorateFromAny(auth?.allow, auth?.profile, auth?.userProfile, auth?.authzSnapshot);

  const [tenants, setTenants] = useState<Record<string, TenantInfo>>({});
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrors([]);
      const nextErrors: string[] = [];
      const tenantMap: Record<string, TenantInfo> = {};
      const auditRows: AuditRow[] = [];

      try {
        const tenantDocs = new Map<string, any>();

        if (isOwner || !currentGovernorate) {
          const tenantSnap = await getDocs(collection(db, "tenants"));
          tenantSnap.forEach((docSnap) => tenantDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
        } else {
          let successCount = 0;

          for (const fieldName of GOVERNORATE_FIELD_CANDIDATES) {
            try {
              const tenantSnap = await getDocs(query(collection(db, "tenants"), where(fieldName, "==", currentGovernorate)));
              tenantSnap.forEach((docSnap) => tenantDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
              successCount += 1;
            } catch {
              // بعض الحقول قد لا تكون مستخدمة في قاعدة البيانات؛ نكمل باقي الحقول.
            }
          }

          if (successCount === 0) {
            throw new Error("لم تنجح أي قراءة مفلترة بالمحافظة من مجموعة tenants");
          }
        }

        tenantDocs.forEach((entry) => {
          const data = entry.data as any;
          const gov = getGovernorateFromAny(data);
          if (!isOwner && currentGovernorate && !sameGovernorate(gov, currentGovernorate)) return;
          tenantMap[entry.id] = {
            id: entry.id,
            name: getTenantName(data) || entry.id,
            governorate: gov,
            tenantType: getTenantType(data),
          };
        });
      } catch (e: any) {
        nextErrors.push(`تعذر قراءة قائمة المدارس والمراكز: ${e?.message || e}`);
      }

      try {
        const allowDocs = new Map<string, any>();

        if (isOwner || !currentGovernorate) {
          const allowSnap = await getDocs(collection(db, "allowlist"));
          allowSnap.forEach((docSnap) => allowDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
        } else {
          for (const fieldName of GOVERNORATE_FIELD_CANDIDATES) {
            try {
              const allowSnap = await getDocs(query(collection(db, "allowlist"), where(fieldName, "==", currentGovernorate)));
              allowSnap.forEach((docSnap) => allowDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // نكمل باقي حقول المحافظة.
            }
          }

          const tenantIds = Object.keys(tenantMap).filter(Boolean);
          for (const tenantIdChunk of chunkArray(tenantIds, FIRESTORE_IN_LIMIT)) {
            if (!tenantIdChunk.length) continue;
            try {
              const allowSnap = await getDocs(query(collection(db, "allowlist"), where("tenantId", "in", tenantIdChunk)));
              allowSnap.forEach((docSnap) => allowDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // بعض قواعد البيانات القديمة قد لا تحتوي tenantId في كل السجلات.
            }
          }
        }

        allowDocs.forEach((entry) => {
          const data = entry.data as any;
          const tenantId = String(data?.tenantId || data?.effectiveTenantId || "").trim();
          const tenant = tenantMap[tenantId];
          const gov = getGovernorateFromAny(data, tenant);
          if (!isOwner && currentGovernorate && !sameGovernorate(gov, currentGovernorate)) return;
          const rowRole = String(data?.role || "").trim();
          auditRows.push({
            id: `allowlist:${entry.id}`,
            email: String(data?.email || entry.id || "").trim(),
            name: getNameFromAny(data) || String(data?.email || entry.id || "").split("@")[0],
            role: rowRole,
            roleLabel: roleLabel(rowRole),
            governorate: gov,
            tenantId,
            tenantName: tenant?.name || String(data?.schoolName || data?.tenantName || "").trim(),
            tenantType: tenant?.tenantType || getTenantType(data),
            enabled: data?.enabled !== false,
            source: "allowlist",
            scopeStatus: !currentGovernorate ? "unknown" : sameGovernorate(gov, currentGovernorate) ? "inside" : "outside",
          });
        });
      } catch (e: any) {
        nextErrors.push(`تعذر قراءة صلاحيات allowlist. غالبًا تحتاج نشر قواعد Firestore المرفقة مع هذه المرحلة: ${e?.message || e}`);
      }

      try {
        const extraDocs = new Map<string, any>();

        if (isOwner || !currentGovernorate) {
          const extraSnap = await getDocs(collection(db, "governorateExamSupers"));
          extraSnap.forEach((docSnap) => extraDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
        } else {
          for (const fieldName of GOVERNORATE_FIELD_CANDIDATES) {
            try {
              const extraSnap = await getDocs(query(collection(db, "governorateExamSupers"), where(fieldName, "==", currentGovernorate)));
              extraSnap.forEach((docSnap) => extraDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // نكمل باقي حقول المحافظة.
            }
          }

          const tenantIds = Object.keys(tenantMap).filter(Boolean);
          for (const tenantIdChunk of chunkArray(tenantIds, FIRESTORE_IN_LIMIT)) {
            if (!tenantIdChunk.length) continue;
            try {
              const extraSnap = await getDocs(query(collection(db, "governorateExamSupers"), where("tenantId", "in", tenantIdChunk)));
              extraSnap.forEach((docSnap) => extraDocs.set(docSnap.id, { id: docSnap.id, data: docSnap.data() }));
            } catch {
              // نكمل بدون إيقاف الصفحة.
            }
          }
        }

        extraDocs.forEach((entry) => {
          const data = entry.data as any;
          const tenantId = String(data?.tenantId || "").trim();
          const tenant = tenantMap[tenantId];
          const gov = getGovernorateFromAny(data, tenant);
          if (!isOwner && currentGovernorate && !sameGovernorate(gov, currentGovernorate)) return;
          const email = String(data?.email || entry.id || "").trim();
          if (auditRows.some((r) => normalizeText(r.email) === normalizeText(email) && normalizeText(r.tenantId) === normalizeText(tenantId))) return;
          auditRows.push({
            id: `governorateExamSupers:${entry.id}`,
            email,
            name: getNameFromAny(data) || email.split("@")[0],
            role: "exam_super",
            roleLabel: "سوبر الامتحانات",
            governorate: gov,
            tenantId,
            tenantName: tenant?.name || String(data?.centerName || data?.schoolName || "").trim(),
            tenantType: "exam_center",
            enabled: data?.enabled !== false,
            source: "governorateExamSupers",
            scopeStatus: !currentGovernorate ? "unknown" : sameGovernorate(gov, currentGovernorate) ? "inside" : "outside",
          });
        });
      } catch (e: any) {
        nextErrors.push(`تعذر قراءة قائمة سوبر الامتحانات الثانوية: ${e?.message || e}`);
      }

      if (mounted) {
        setTenants(tenantMap);
        setRows(auditRows.sort((a, b) => a.roleLabel.localeCompare(b.roleLabel, "ar") || a.email.localeCompare(b.email)));
        setErrors(nextErrors);
        setLoading(false);
      }
    }

    if (isOwner || isGovSuper) void load();
    else setLoading(false);

    return () => {
      mounted = false;
    };
  }, [isOwner, isGovSuper, currentGovernorate]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter((row) => {
      if (filter !== "all") {
        if (filter === "enabled" && !row.enabled) return false;
        if (filter === "disabled" && row.enabled) return false;
        if (filter === "school" && row.tenantType === "exam_center") return false;
        if (filter === "exam" && row.tenantType !== "exam_center") return false;
        if (filter === "outside" && row.scopeStatus !== "outside") return false;
      }
      if (!q) return true;
      return [row.email, row.name, row.roleLabel, row.governorate, row.tenantId, row.tenantName]
        .map(normalizeText)
        .some((x) => x.includes(q));
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const enabled = rows.filter((r) => r.enabled).length;
    const schools = rows.filter((r) => r.tenantType !== "exam_center").length;
    const exams = rows.filter((r) => r.tenantType === "exam_center").length;
    const outside = rows.filter((r) => r.scopeStatus === "outside").length;
    return { total: rows.length, enabled, schools, exams, outside };
  }, [rows]);

  const openTenant = (row: AuditRow) => {
    if (!row.tenantId) return;
    const tenant = tenants[row.tenantId];
    const route = isExamRole(row.role, tenant) || row.tenantType === "exam_center" ? `/t/${row.tenantId}/dashboard12` : `/t/${row.tenantId}`;

    if (isGovSuper) setReadOnlyView(row.tenantId);
    else clearReadOnlyView();

    navigate(route);
  };

  if (!isOwner && !isGovSuper) {
    return (
      <div dir="rtl" className="permissions-audit-page" style={shellStyle}>
        <AuditReadableCss />
        <section style={panelStyle}>
          <h1 style={titleStyle}>غير مصرح</h1>
          <p style={mutedStyle}>هذه الصفحة مخصصة لمالك المنصة أو مشرف المحافظة فقط.</p>
          <button style={secondaryButtonStyle} onClick={() => navigate("/")}>العودة</button>
        </section>
      </div>
    );
  }

  return (
    <div dir="rtl" className="permissions-audit-page" style={shellStyle}>
      <AuditReadableCss />
      <section style={heroStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <button type="button" style={secondaryButtonStyle} onClick={() => navigate(isOwner ? "/system" : "/super-system")}>العودة</button>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={MINISTRY_LOGO_URL} alt="وزارة التعليم" style={logoStyle} />
            <div>
              <div style={ministryStyle}>سلطنة عمان</div>
              <div style={ministryStyle}>وزارة التعليم</div>
              <div style={mutedStyle}>{currentGovernorate || "نطاق مالك المنصة"}</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", display: "grid", gap: 12 }}>
          <h1 style={titleStyle}>فحص الصلاحيات والربط</h1>
          <p style={subtitleStyle}>مراجعة المستخدمين، الأدوار، المحافظة، المدرسة أو مركز الدبلوم، وحالة الدخول والمشاهدة فقط.</p>
        </div>
      </section>

      <section style={gridStatsStyle}>
        <Stat label="إجمالي المستخدمين" value={stats.total} />
        <Stat label="مفعل" value={stats.enabled} />
        <Stat label="أدمنات مدارس" value={stats.schools} />
        <Stat label="سوبر امتحانات" value={stats.exams} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 220px auto", gap: 12, alignItems: "end" }}>
          <label style={labelStyle}>بحث
            <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالبريد أو الدور أو المركز..." />
          </label>
          <label style={labelStyle}>تصفية
            <select style={inputStyle} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value="enabled">المفعل فقط</option>
              <option value="disabled">الموقوف فقط</option>
              <option value="school">المدارس</option>
              <option value="exam">مراكز الدبلوم</option>
              <option value="outside">خارج النطاق</option>
            </select>
          </label>
          <button style={primaryButtonStyle} onClick={() => window.location.reload()}>تحديث الفحص</button>
        </div>

        {errors.length ? (
          <div className="audit-warning" style={warningStyle}>
            <b>تنبيهات أثناء الفحص:</b>
            {errors.map((err, index) => <div key={index}>{err}</div>)}
          </div>
        ) : null}

        {loading ? (
          <div style={emptyStyle}>جاري تحميل بيانات الصلاحيات...</div>
        ) : filteredRows.length === 0 ? (
          <div style={emptyStyle}>لا توجد نتائج مطابقة للفحص الحالي.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>المحافظة</th>
                  <th>المدرسة / المركز</th>
                  <th>الحالة</th>
                  <th>الدخول</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const inside = row.scopeStatus !== "outside";
                  const canOpen = Boolean(row.tenantId && (isOwner || inside));
                  return (
                    <tr key={row.id}>
                      <td>
                        <div style={{ fontWeight: 1000 }}>{row.name || "—"}</div>
                        <div style={cellSubStyle}>{row.email || "—"}</div>
                      </td>
                      <td><span style={badgeStyle}>{row.roleLabel}</span><div style={cellSubStyle}>{row.role || "—"}</div></td>
                      <td>{row.governorate || "—"}</td>
                      <td>
                        <div style={{ fontWeight: 900 }}>{row.tenantName || row.tenantId || "—"}</div>
                        <div style={cellSubStyle}>{row.tenantId || "لا يوجد Tenant"}</div>
                      </td>
                      <td>
                        <span style={row.enabled ? okBadgeStyle : stopBadgeStyle}>{row.enabled ? "مفعل" : "موقوف"}</span>
                        <div style={cellSubStyle}>{inside ? "داخل النطاق" : "خارج نطاق المحافظة"}</div>
                      </td>
                      <td>
                        <button style={canOpen ? primarySmallStyle : disabledButtonStyle} disabled={!canOpen} onClick={() => openTenant(row)}>
                          {isGovSuper ? "فتح مشاهدة فقط" : "فتح"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AuditReadableCss() {
  return (
    <style>{`
      .permissions-audit-page,
      .permissions-audit-page * {
        color: #111827;
        font-weight: 800;
      }
      .permissions-audit-page input,
      .permissions-audit-page select,
      .permissions-audit-page textarea {
        color: #000000 !important;
        background: #fffdf5 !important;
        font-weight: 1000 !important;
        opacity: 1 !important;
      }
      .permissions-audit-page input::placeholder,
      .permissions-audit-page textarea::placeholder {
        color: #111827 !important;
        opacity: 1 !important;
        font-weight: 900 !important;
      }
      .permissions-audit-page table th,
      .permissions-audit-page table td {
        color: #000000 !important;
        font-weight: 900 !important;
      }
      .permissions-audit-page button {
        color: #000000 !important;
        font-weight: 1000 !important;
      }
      .permissions-audit-page .audit-warning,
      .permissions-audit-page .audit-warning * {
        color: #7c1d1d !important;
        font-weight: 1000 !important;
      }
    `}</style>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: 34, fontWeight: 1000, color: "#111827" }}>{value}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#6b4e00" }}>{label}</div>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: BG,
  padding: 28,
  boxSizing: "border-box",
  color: "#111827",
  display: "grid",
  gap: 22,
  alignContent: "start",
};
const heroStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffaf0 0%, #f8efd7 100%)",
  border: `5px solid ${GOLD}`,
  borderRadius: 38,
  padding: 28,
  boxShadow: "0 16px 42px rgba(120,90,10,0.14)",
};
const panelStyle: React.CSSProperties = {
  background: CARD,
  border: `4px solid ${GOLD}`,
  borderRadius: 32,
  padding: 24,
  boxShadow: "0 12px 30px rgba(120,90,10,0.12)",
  display: "grid",
  gap: 18,
};
const gridStatsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 14 };
const statStyle: React.CSSProperties = { background: CARD, border: `3px solid ${GOLD}`, borderRadius: 24, padding: 18, textAlign: "center" };
const logoStyle: React.CSSProperties = { width: 86, height: 86, objectFit: "contain", border: `3px solid ${GOLD}`, borderRadius: 18, background: "#fff" };
const ministryStyle: React.CSSProperties = { fontSize: 26, fontWeight: 1000, color: "#6b4e00" };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: "clamp(34px, 5vw, 64px)", fontWeight: 1000, lineHeight: 1.15 };
const subtitleStyle: React.CSSProperties = { margin: 0, fontSize: 19, fontWeight: 800, color: "#3f3f46" };
const mutedStyle: React.CSSProperties = { color: "#111827", fontWeight: 1000 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 8, fontWeight: 1000, color: "#000000" };
const inputStyle: React.CSSProperties = { minHeight: 52, border: `2px solid ${GOLD}`, borderRadius: 14, padding: "0 14px", background: "#fffdf5", fontWeight: 1000, color: "#000000", fontSize: 16 };
const primaryButtonStyle: React.CSSProperties = { minHeight: 48, border: `3px solid ${GOLD}`, borderRadius: 14, background: "linear-gradient(180deg,#f3d46b,#d4af37)", color: "#111827", fontWeight: 1000, cursor: "pointer", padding: "0 18px" };
const secondaryButtonStyle: React.CSSProperties = { minHeight: 48, border: `3px solid ${GOLD}`, borderRadius: 14, background: "#fffdf5", color: "#111827", fontWeight: 1000, cursor: "pointer", padding: "0 18px" };
const warningStyle: React.CSSProperties = { border: "3px solid #dc2626", background: "#fff1f2", color: "#7c1d1d", borderRadius: 18, padding: 16, fontWeight: 1000, lineHeight: 2, fontSize: 16 };
const emptyStyle: React.CSSProperties = { padding: 18, textAlign: "center", fontWeight: 1000, color: "#000000", fontSize: 17 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 980 };
const cellSubStyle: React.CSSProperties = { fontSize: 14, color: "#111827", fontWeight: 900, marginTop: 4 };
const badgeStyle: React.CSSProperties = { display: "inline-flex", padding: "7px 12px", border: `2px solid ${GOLD}`, borderRadius: 999, background: "#fff7d6", fontWeight: 1000 };
const okBadgeStyle: React.CSSProperties = { ...badgeStyle, borderColor: "#16a34a", background: "#dcfce7", color: "#166534" };
const stopBadgeStyle: React.CSSProperties = { ...badgeStyle, borderColor: "#dc2626", background: "#fee2e2", color: "#991b1b" };
const primarySmallStyle: React.CSSProperties = { ...primaryButtonStyle, minHeight: 40, fontSize: 14 };
const disabledButtonStyle: React.CSSProperties = { ...primarySmallStyle, cursor: "not-allowed", opacity: 0.5 };
