
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { DIRECTORATES } from "../constants/directorates";
import {
  clearRegionalSuperTenantBindingAction,
  getTenantManagerDetailsAction,
  listRegionalSupersAction,
  listTenantsGroupedByGovernorateAction,
  migrateTenantIdAction,
  updateRegionalSuperGovernorateAction,
} from "../features/system-admin/services/adminTenantGovernorateTools";

const panel: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 20,
  background: "rgba(255,255,255,0.03)",
  padding: 16,
  boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  background: "rgba(2,6,23,.58)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#f8fafc",
  outline: "none",
};

const btn = (danger = false): React.CSSProperties => ({
  padding: "10px 14px",
  borderRadius: 12,
  border: `1px solid ${danger ? "rgba(239,68,68,0.35)" : "rgba(212,175,55,0.30)"}`,
  background: danger ? "rgba(239,68,68,0.12)" : "rgba(212,175,55,0.16)",
  color: danger ? "#fecaca" : "#f5e7b2",
  fontWeight: 900,
  cursor: "pointer",
});

export default function GovernorateTenantsManager() {
  const { user } = useAuth() as any;
  const [rows, setRows] = useState<any[]>([]);
  const [supers, setSupers] = useState<any[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [details, setDetails] = useState<any | null>(null);
  const [newTenantId, setNewTenantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    const [tenantRows, superRows] = await Promise.all([
      listTenantsGroupedByGovernorateAction(),
      listRegionalSupersAction(),
    ]);
    setRows(tenantRows);
    setSupers(superRows);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) {
      setDetails(null);
      return;
    }
    getTenantManagerDetailsAction(selectedTenantId).then(setDetails).catch((e: any) => {
      setDetails(null);
      setMsg(String(e?.message || e));
    });
  }, [selectedTenantId]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const gov = String(row?.governorate || "غير مصنفة").trim();
      if (!selectedGovernorate || gov === selectedGovernorate) {
        if (!map.has(gov)) map.set(gov, []);
        map.get(gov)!.push(row);
      }
    }
    return Array.from(map.entries());
  }, [rows, selectedGovernorate]);

  return (
    <div style={{ minHeight: "100vh", background: "#071225", color: "#f5e7b2", padding: 18, direction: "rtl" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={panel}>
          <div style={{ fontSize: 24, fontWeight: 950, marginBottom: 8 }}>المدارس حسب المحافظات وإدارة Tenant</div>
          <div style={{ opacity: 0.85, lineHeight: 1.9 }}>
            تعرض هذه الصفحة المدارس مرتبة حسب المحافظات. عند اختيار مدرسة تظهر بياناتها الكاملة، مع إمكانية تنفيذ نقل آمن لـ Tenant ID.
            كما تعرض سجلات سوبر المحافظات لتصحيح أي Tenant مربوط بالخطأ، لأن الصحيح أن سوبر المحافظات يرتبط بالمحافظة فقط.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16, alignItems: "start" }}>
          <div style={panel}>
            <div style={{ fontWeight: 900, marginBottom: 12 }}>اختيار المحافظة والمدرسة</div>
            <select value={selectedGovernorate} onChange={(e) => setSelectedGovernorate(e.target.value)} style={input}>
              <option value="">كل المحافظات</option>
              {DIRECTORATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <div style={{ height: 12 }} />
            <div style={{ maxHeight: 560, overflow: "auto", display: "grid", gap: 12 }}>
              {grouped.map(([gov, items]) => (
                <div key={gov} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>{gov}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {items.map((row: any) => {
                      const active = selectedTenantId === row.tenantId;
                      return (
                        <button
                          key={row.tenantId}
                          onClick={() => setSelectedTenantId(row.tenantId)}
                          style={{
                            ...btn(false),
                            textAlign: "right",
                            background: active ? "rgba(212,175,55,0.22)" : "rgba(255,255,255,0.04)",
                            border: active ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.10)",
                          }}
                        >
                          {row.schoolName} ({row.tenantId})
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={panel}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>بيانات المدرسة المحددة</div>
              {!details ? (
                <div style={{ opacity: 0.8 }}>اختر مدرسة أولًا.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>اسم المدرسة</div>
                    <input style={input} value={details.schoolName || ""} readOnly />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>Tenant ID الحالي</div>
                    <input style={input} value={details.tenantId || ""} readOnly />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>المحافظة</div>
                    <input style={input} value={details.governorate || ""} readOnly />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>البريد المرتبط</div>
                    <input style={input} value={details.linkedEmail || ""} readOnly />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6, opacity: 0.85 }}>حالة المدرسة</div>
                    <input style={input} value={details.enabled ? "مفعلة" : "غير مفعلة"} readOnly />
                  </div>
                </div>
              )}
            </div>

            <div style={panel}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>نقل Tenant ID إلى قيمة جديدة</div>
              <div style={{ opacity: 0.85, marginBottom: 12, lineHeight: 1.8 }}>
                هذه العملية تنسخ المدرسة وكل الربوط التابعة لها إلى Tenant جديد، ثم تؤرشف القديم وتحدث allowlist و tenantAdminLinks.
              </div>
              <input
                style={input}
                value={newTenantId}
                onChange={(e) => setNewTenantId(e.target.value)}
                placeholder="Tenant ID الجديد"
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  style={btn(false)}
                  disabled={!selectedTenantId || !newTenantId || busy}
                  onClick={async () => {
                    if (!user || !selectedTenantId || !newTenantId) return;
                    const ok = window.confirm(`هل تريد نقل Tenant ID من "${selectedTenantId}" إلى "${newTenantId}"؟`);
                    if (!ok) return;
                    try {
                      setBusy(true);
                      setMsg("");
                      await migrateTenantIdAction({ user, oldTenantId: selectedTenantId, newTenantId });
                      setMsg("تم نقل Tenant ID بنجاح.");
                      setSelectedTenantId(newTenantId.trim().toLowerCase());
                      setNewTenantId("");
                      await refresh();
                    } catch (e: any) {
                      setMsg(String(e?.message || e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  تنفيذ نقل Tenant
                </button>
              </div>
            </div>

            <div style={panel}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>سوبر المحافظات</div>
              <div style={{ opacity: 0.85, marginBottom: 12, lineHeight: 1.8 }}>
                سوبر المحافظات يجب أن يرتبط بالمحافظة فقط. إذا وجدت قيمة Tenant مربوطة به بالخطأ، يمكنك تنظيفها من هنا.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {supers.map((row: any) => (
                  <div key={row.email} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1.2fr 1fr 180px 180px", gap: 10, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{row.email}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{row.userName || row.name || ""}</div>
                    </div>
                    <select
                      defaultValue={row.governorate || ""}
                      onChange={async (e) => {
                        if (!user) return;
                        try {
                          await updateRegionalSuperGovernorateAction({ user, email: row.email, governorate: e.target.value });
                          setMsg("تم تحديث محافظة سوبر المحافظات.");
                          await refresh();
                        } catch (err: any) {
                          setMsg(String(err?.message || err));
                        }
                      }}
                      style={input}
                    >
                      <option value="">اختر المحافظة</option>
                      {DIRECTORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <input style={input} readOnly value={row.tenantId || "—"} />
                    <button
                      style={btn(true)}
                      onClick={async () => {
                        if (!user) return;
                        try {
                          await clearRegionalSuperTenantBindingAction({ user, email: row.email });
                          setMsg("تم تنظيف Tenant المرتبط بسوبر المحافظات.");
                          await refresh();
                        } catch (err: any) {
                          setMsg(String(err?.message || err));
                        }
                      }}
                    >
                      تنظيف Tenant
                    </button>
                  </div>
                ))}
                {!supers.length ? <div style={{ opacity: 0.8 }}>لا يوجد سجلات لسوبر المحافظات.</div> : null}
              </div>
            </div>

            {msg ? <div style={{ ...panel, color: "#fff8dc", fontWeight: 800 }}>{msg}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
