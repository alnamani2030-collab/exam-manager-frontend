// src/pages/SystemErrorLog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import {
  clearLocalSystemErrors,
  isCloudErrorLogEnabled,
  readLocalSystemErrors,
  recordSystemError,
  setCloudErrorLogEnabled,
  type SystemErrorLogEntry,
} from "../features/diagnostics/errorDiagnostics";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD = "#b9931f";

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function normalizeRole(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isOwnerRole(auth: any) {
  const email = String(auth?.user?.email || "").trim().toLowerCase();
  const profile = getProfile(auth);
  const role = normalizeRole(profile?.role || auth?.effectiveRole);
  return email === "3asal2030@gmail.com" || ["owner", "platform_owner", "super_admin", "ministry_super"].includes(role);
}

function isGovernorateSuper(auth: any) {
  const profile = getProfile(auth);
  const role = normalizeRole(profile?.role || auth?.effectiveRole);
  return ["super", "governorate_super", "governorate-super", "regional_super", "super_regional", "مشرف المحافظة", "سوبر المحافظة"].includes(role);
}

function uniqMerge(rows: SystemErrorLogEntry[]) {
  const map = new Map<string, SystemErrorLogEntry>();
  for (const row of rows) {
    const key = row.id || `${row.at}|${row.message}|${row.path}`;
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export default function SystemErrorLog() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const profile = getProfile(auth);
  const userEmail = String(auth?.user?.email || profile?.email || "").trim();
  const governorate = String(profile?.governorate || profile?.tenantGovernorate || "").trim();

  const [localRows, setLocalRows] = useState<SystemErrorLogEntry[]>(() => readLocalSystemErrors());
  const [cloudRows, setCloudRows] = useState<SystemErrorLogEntry[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [cloudEnabled, setCloudEnabled] = useState(() => isCloudErrorLogEnabled());

  const rows = useMemo(() => uniqMerge([...localRows, ...cloudRows]), [localRows, cloudRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (level && row.level !== level) return false;
      if (!q) return true;
      return [row.message, row.source, row.path, row.userEmail, row.role, row.governorate, row.tenantId]
        .map((x) => String(x || "").toLowerCase())
        .some((x) => x.includes(q));
    });
  }, [rows, search, level]);

  async function loadCloud() {
    setLoadingCloud(true);
    setCloudError("");
    try {
      let qRef: any;
      if (isOwnerRole(auth)) {
        qRef = query(collection(db, "systemErrorLogs"), limit(250));
      } else if (isGovernorateSuper(auth) && governorate) {
        qRef = query(collection(db, "systemErrorLogs"), where("governorate", "==", governorate), limit(250));
      } else if (userEmail) {
        qRef = query(collection(db, "systemErrorLogs"), where("userEmail", "==", userEmail), limit(100));
      } else {
        setCloudRows([]);
        return;
      }

      const snap = await getDocs(qRef);
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SystemErrorLogEntry[];
      setCloudRows(next);
    } catch (e: any) {
      setCloudError(e?.message || "تعذر قراءة سجل الأخطاء السحابي.");
    } finally {
      setLoadingCloud(false);
    }
  }

  useEffect(() => {
    setLocalRows(readLocalSystemErrors());
    void loadCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, governorate]);

  async function addTestError() {
    await recordSystemError({
      level: "warning",
      source: "manual-test",
      message: "اختبار يدوي لسجل الأخطاء من صفحة سجل الأخطاء.",
      userEmail,
      role: String(profile?.role || ""),
      governorate,
      tenantId: String(profile?.tenantId || ""),
    });
    setLocalRows(readLocalSystemErrors());
    await loadCloud();
  }

  function toggleCloud() {
    const next = !cloudEnabled;
    setCloudEnabled(next);
    setCloudError(next ? "تم تفعيل السجل السحابي." : "تم إيقاف السجل السحابي.");
    try {
      setCloudErrorLogEnabled(next);
    } catch {
      // تجاهل أي مشكلة في التخزين المحلي.
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-error-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearLocal() {
    if (!window.confirm("سيتم تنظيف سجل الأخطاء المحلي فقط. السجل السحابي لن يتم حذفه. هل تريد المتابعة؟")) return;
    clearLocalSystemErrors();
    setLocalRows([]);
  }

  const summary = {
    total: rows.length,
    shown: filtered.length,
    errors: rows.filter((r) => r.level === "error").length,
    warnings: rows.filter((r) => r.level === "warning").length,
  };

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: "#f4efdF", color: "#111827", padding: 24, direction: "rtl" },
    hero: { background: "#fffaf0", border: `3px solid ${GOLD}`, borderRadius: 28, padding: 28, textAlign: "center", boxShadow: "0 16px 36px rgba(0,0,0,.08)" },
    logo: { width: 76, height: 76, objectFit: "contain", border: `2px solid ${GOLD}`, borderRadius: 18, padding: 8, background: "#fff" },
    cards: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginTop: 18 },
    card: { background: "#fffdf5", border: `2px solid ${GOLD}`, borderRadius: 18, padding: 16, fontWeight: 900 },
    panel: { background: "#fffdf5", border: `2px solid ${GOLD}`, borderRadius: 22, padding: 18, marginTop: 22 },
    input: { width: "100%", border: "1px solid #d6bd64", borderRadius: 12, padding: 12, color: "#000", fontWeight: 900, background: "#fff" },
    button: { border: `2px solid ${GOLD}`, borderRadius: 12, padding: "10px 14px", background: "#fff8dc", color: "#111827", fontWeight: 1000, cursor: "pointer" },
    danger: { border: "2px solid #991b1b", borderRadius: 12, padding: "10px 14px", background: "#fff1f2", color: "#991b1b", fontWeight: 1000, cursor: "pointer" },
    table: { width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 14 },
    th: { background: "#eadc9b", padding: 10, border: "1px solid #d6bd64", color: "#111827" },
    td: { padding: 10, border: "1px solid #eadc9b", verticalAlign: "top", color: "#111827", fontWeight: 700 },
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <button style={styles.button} onClick={() => navigate(-1)}>العودة</button>
          <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={styles.logo} />
          <div style={{ textAlign: "right", fontWeight: 900 }}>سلطنة عمان<br />وزارة التعليم<br />نظام إدارة الامتحانات المطور</div>
        </div>
        <h1 style={{ fontSize: 46, margin: "20px 0 8px", color: "#111827" }}>سجل الأخطاء</h1>
        <p style={{ fontWeight: 800 }}>متابعة أخطاء المتصفح والسحابة والتجمّد لتسهيل الوصول إلى نسخة تجارية مستقرة.</p>
      </section>

      <section style={styles.cards}>
        <div style={styles.card}><div style={{ fontSize: 28 }}>{summary.total}</div><div>إجمالي الأخطاء</div></div>
        <div style={styles.card}><div style={{ fontSize: 28 }}>{summary.errors}</div><div>أخطاء حرجة</div></div>
        <div style={styles.card}><div style={{ fontSize: 28 }}>{summary.warnings}</div><div>تحذيرات</div></div>
        <div style={styles.card}><div style={{ fontSize: 28 }}>{summary.shown}</div><div>نتائج العرض</div></div>
      </section>

      <section style={styles.panel}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, alignItems: "end" }}>
          <label style={{ fontWeight: 1000 }}>بحث
            <input style={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في الرسالة أو المسار أو المستخدم..." />
          </label>
          <label style={{ fontWeight: 1000 }}>النوع
            <select style={styles.input} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">الكل</option>
              <option value="error">أخطاء</option>
              <option value="warning">تحذيرات</option>
              <option value="info">معلومات</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button style={styles.button} onClick={loadCloud} disabled={loadingCloud}>{loadingCloud ? "جار التحميل..." : "تحديث السجل"}</button>
          <button style={styles.button} onClick={addTestError}>تسجيل فحص</button>
          <button style={styles.button} onClick={exportJson}>تصدير JSON</button>
          <button style={styles.button} onClick={toggleCloud}>{cloudEnabled ? "إيقاف السجل السحابي" : "تفعيل السجل السحابي"}</button>
          <button style={styles.danger} onClick={clearLocal}>تنظيف السجل المحلي</button>
        </div>
        {cloudError ? <div style={{ marginTop: 12, color: cloudError.includes("تعذر") ? "#991b1b" : "#166534", fontWeight: 1000 }}>{cloudError}</div> : null}

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>الوقت</th>
              <th style={styles.th}>النوع</th>
              <th style={styles.th}>المصدر</th>
              <th style={styles.th}>الرسالة</th>
              <th style={styles.th}>المستخدم</th>
              <th style={styles.th}>المسار</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ ...styles.td, textAlign: "center", padding: 26 }}>لا توجد أخطاء مطابقة للعرض الحالي.</td></tr>
            ) : filtered.map((row) => (
              <tr key={row.id || `${row.at}-${row.message}`}>
                <td style={styles.td}>{row.at ? new Date(row.at).toLocaleString("ar") : "—"}</td>
                <td style={{ ...styles.td, color: row.level === "error" ? "#991b1b" : "#92400e" }}>{row.level}</td>
                <td style={styles.td}>{row.source || "—"}</td>
                <td style={{ ...styles.td, maxWidth: 520, whiteSpace: "pre-wrap" }}>{row.message}</td>
                <td style={styles.td}>{row.userEmail || "—"}<br />{row.role || ""}</td>
                <td style={styles.td}>{row.path || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
