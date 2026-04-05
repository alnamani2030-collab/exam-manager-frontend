import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatArchiveTitle, type ArchivedDistributionRun } from "../utils/taskDistributionStorage";
import { useArchiveItems } from "../features/archive/hooks/useArchiveItems";
import { removeArchivedItem, restoreArchivedRun } from "../features/archive/services/archiveService";
import type { ArchiveItem } from "../features/archive/types";
import { useTenant } from "../tenant/TenantContext";

const GOLD = "#f5c84c";
const BG = "#060b16";
const PANEL = "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))";
const PANEL_SOFT = "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))";
const STROKE = "rgba(245,200,76,0.18)";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";

function sourceLabel(src?: ArchiveItem["__source"]) {
  if (src === "both") return "محلي + سحابي";
  if (src === "cloud") return "سحابي";
  return "محلي";
}

function sourceTone(src?: ArchiveItem["__source"]) {
  if (src === "cloud") return { color: BLUE, bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.32)" };
  if (src === "both") return { color: GREEN, bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.32)" };
  return { color: GOLD, bg: "rgba(245,200,76,0.12)", border: "rgba(245,200,76,0.28)" };
}

function surface(borderColor = STROKE, background = PANEL): React.CSSProperties {
  return {
    border: `1px solid ${borderColor}`,
    borderRadius: 24,
    background,
    boxShadow: "0 18px 44px rgba(0,0,0,0.34)",
    backdropFilter: "blur(12px)",
  };
}

function actionButton(kind: "soft" | "danger" | "brand" = "soft"): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 14,
    padding: "11px 14px",
    border: `1px solid ${STROKE}`,
    fontWeight: 900,
    cursor: "pointer",
    color: "#f8e7b2",
    background: "rgba(255,255,255,0.04)",
  };
  if (kind === "brand") return { ...base, background: "rgba(245,200,76,0.14)", borderColor: "rgba(245,200,76,0.40)", color: GOLD };
  if (kind === "danger") return { ...base, background: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.34)", color: "#fecaca" };
  return base;
}

function StatusPill({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        color,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 14px ${color}` }} />
      {label}
    </span>
  );
}

function StatCard({ title, value, note, accent = GOLD }: { title: string; value: React.ReactNode; note: string; accent?: string }) {
  return (
    <div style={{ ...surface(), padding: 18, minHeight: 126, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineEnd: -24, top: -26, width: 100, height: 100, borderRadius: "50%", background: `${accent}14` }} />
      <div style={{ fontSize: 13, color: "rgba(248,231,178,0.72)", fontWeight: 800, position: "relative" }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 950, color: accent, marginTop: 8, position: "relative" }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(248,231,178,0.62)", marginTop: 8, position: "relative" }}>{note}</div>
    </div>
  );
}

function ArchiveMetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, color: "rgba(248,231,178,0.66)", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#fff5cf", fontWeight: 800, lineHeight: 1.7 }}>{value}</div>
    </div>
  );
}

export default function Archive() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || user?.tenantId || "default").trim() || "default";

  const [tick, setTick] = useState(0);
  const { items, cloudOk, cloudErr, cloudStatus, checkCloud } = useArchiveItems(tenantId, tick);

  const restore = (it: ArchiveItem) => {
    if (restoreArchivedRun(tenantId, it)) nav("/task-distribution/results");
  };

  const remove = async (it: ArchiveItem) => {
    if (!it?.archiveId) return;
    if (!window.confirm("حذف هذه النسخة من الأرشيف؟")) return;
    await removeArchivedItem(tenantId, it);
    setTick((x) => x + 1);
  };

  const stats = useMemo(() => {
    const local = items.filter((it) => it.__source === "local").length;
    const cloud = items.filter((it) => it.__source === "cloud").length;
    const both = items.filter((it) => it.__source === "both").length;
    const latest = items[0] || null;
    const latestTitle = latest ? formatArchiveTitle(latest as ArchivedDistributionRun) : "لا توجد نسخة";
    return {
      total: items.length,
      local,
      cloud,
      both,
      latestTitle,
    };
  }, [items]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top, rgba(245,200,76,0.14), transparent 18%), radial-gradient(circle at 85% 20%, rgba(96,165,250,0.10), transparent 20%), linear-gradient(180deg, ${BG} 0%, #091124 100%)`,
        color: "#f5e7b2",
        direction: "rtl",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 20, position: "relative" }}>
        <div
          style={{
            ...surface("rgba(245,200,76,0.22)", "linear-gradient(120deg, rgba(45,31,4,0.96), rgba(7,12,24,0.96) 45%, rgba(8,20,36,0.98))"),
            padding: 28,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", insetInlineEnd: -90, top: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(245,200,76,0.12)", filter: "blur(8px)" }} />
          <div style={{ position: "absolute", insetInlineStart: -60, bottom: -90, width: 220, height: 220, borderRadius: "50%", background: "rgba(96,165,250,0.09)", filter: "blur(8px)" }} />

          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatusPill label="الأرشيف الموحد" color={GOLD} bg="rgba(245,200,76,0.12)" border="rgba(245,200,76,0.26)" />
                <StatusPill label={cloudOk ? "السحابة متصلة" : "السحابة غير متاحة"} color={cloudOk ? GREEN : RED} bg={cloudOk ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"} border={cloudOk ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
                <StatusPill label="جاهز للاستعادة" color={BLUE} bg="rgba(96,165,250,0.12)" border="rgba(96,165,250,0.28)" />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={actionButton("soft")} onClick={() => nav("/task-distribution/results")}>العودة للجدول الشامل</button>
                <button style={actionButton("soft")} onClick={() => setTick((x) => x + 1)}>تحديث</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(320px,0.85fr)", gap: 18, alignItems: "stretch" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "#fff0b0", fontWeight: 900, fontSize: 14, letterSpacing: 0.3 }}>ARCHIVE COMMAND CENTER</div>
                <div style={{ fontSize: "clamp(32px, 5vw, 60px)", lineHeight: 1.05, fontWeight: 950, color: "#fff5cf" }}>واجهة الأرشيف الذكي لنسخ التوزيع</div>
                <div style={{ color: "rgba(248,231,178,0.82)", lineHeight: 1.95, fontSize: 15, maxWidth: 920 }}>
                  مركز تنفيذي فاخر يجمع النسخ المحلية والسحابية في تجربة واحدة، ويمنح المسؤول قراءة بصرية واضحة لحالة الأرشيف مع إمكانات الاستعادة والحذف والمتابعة التشغيلية الفورية.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <StatusPill label={`إجمالي النسخ: ${stats.total}`} color={GOLD} bg="rgba(245,200,76,0.10)" border="rgba(245,200,76,0.24)" />
                  <StatusPill label={`الجهة الحالية: ${tenantId}`} color="#e5e7eb" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.14)" />
                </div>
              </div>

              <div style={{ ...surface("rgba(255,255,255,0.08)", PANEL_SOFT), padding: 18, display: "grid", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff5cf" }}>لوحة الحالة التنفيذية</div>
                <div style={{ color: "rgba(248,231,178,0.72)", lineHeight: 1.8, fontSize: 13 }}>
                  ملخص سريع لحالة الأرشيف الحالي، ومصدر النسخ، واتصال السحابة، مع جاهزية فورية لاستعادة أي نسخة إلى الجدول الشامل.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                  <StatCard title="المحلي" value={stats.local} note="نسخ محفوظة داخل الجهاز" accent={GOLD} />
                  <StatCard title="السحابي" value={stats.cloud} note="نسخ محفوظة في السحابة" accent={BLUE} />
                  <StatCard title="مشترك" value={stats.both} note="نسخ موجودة محليًا وسحابيًا" accent={GREEN} />
                  <StatCard title="آخر حالة" value={cloudStatus.ok ? "OK" : "X"} note={cloudStatus.note || "—"} accent={cloudStatus.ok ? GREEN : RED} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <StatCard title="إجمالي النسخ المؤرشفة" value={stats.total} note="كل النسخ المعروضة الآن داخل الصفحة" />
          <StatCard title="الحالة السحابية" value={cloudOk ? "متصل" : "غير متاح"} note={cloudErr || cloudStatus.note || "فحص الاتصال السحابي"} accent={cloudOk ? GREEN : RED} />
          <StatCard title="آخر نسخة مرصودة" value={items[0]?.run?.runId ? String(items[0].run.runId).slice(0, 10) : "—"} note={stats.latestTitle} accent={BLUE} />
          <StatCard title="جاهزية الاستعادة" value={items.length ? "جاهز" : "بانتظار النسخ"} note="يمكن استعادة أي نسخة مباشرة إلى الجدول الشامل" accent={items.length ? GREEN : GOLD} />
        </div>

        <div style={{ ...surface(), padding: 18, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 950, color: "#fff5cf" }}>حالة الربط والتخزين</div>
              <div style={{ marginTop: 6, color: "rgba(248,231,178,0.72)", lineHeight: 1.8, fontSize: 13 }}>
                الصفحة تعرض المحلي والسحابي معًا، وتتيح التحقق من الاتصال السحابي في أي لحظة لمعرفة جاهزية المزامنة والاستعادة.
              </div>
            </div>
            <button style={actionButton("soft")} onClick={checkCloud}>فحص الاتصال السحابي</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatusPill label={`السحابة: ${cloudOk ? "متصلة" : "غير متاحة"}`} color={cloudOk ? GREEN : RED} bg={cloudOk ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"} border={cloudOk ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
            <StatusPill label="المحلي: متاح" color={GOLD} bg="rgba(245,200,76,0.12)" border="rgba(245,200,76,0.28)" />
            <StatusPill label={`الفحص: ${cloudStatus.ok ? "OK" : "X"}`} color={cloudStatus.ok ? GREEN : RED} bg={cloudStatus.ok ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"} border={cloudStatus.ok ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ ...surface("rgba(245,200,76,0.18)", "linear-gradient(180deg, rgba(245,200,76,0.05), rgba(255,255,255,0.02))"), padding: 34, textAlign: "center", display: "grid", gap: 12 }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, background: "rgba(245,200,76,0.10)", border: "1px solid rgba(245,200,76,0.20)", color: GOLD }}>✦</div>
            <div style={{ fontSize: 24, fontWeight: 950, color: "#fff5cf" }}>لا توجد نسخ محفوظة بعد</div>
            <div style={{ maxWidth: 760, margin: "0 auto", color: "rgba(248,231,178,0.76)", lineHeight: 1.9 }}>
              بمجرد حفظ نسخ من التوزيع سيظهر الأرشيف هنا تلقائيًا، مع توضيح مصدر كل نسخة وإمكانية استعادتها أو حذفها من نفس الصفحة.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
            {items.map((it, index) => {
              const title = formatArchiveTitle(it as ArchivedDistributionRun);
              const created = it?.createdAtISO ? new Date(it.createdAtISO).toLocaleString("ar", { hour12: true }) : "—";
              const count = (it?.run?.assignments || []).length;
              const tone = sourceTone(it.__source);
              const isLatest = index === 0;
              return (
                <div key={it.archiveId} style={{ ...surface(tone.border, "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"), padding: 18, display: "grid", gap: 14, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", insetInlineEnd: -30, top: -28, width: 96, height: 96, borderRadius: "50%", background: `${tone.color}12` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", position: "relative" }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isLatest ? <StatusPill label="أحدث نسخة" color={GREEN} bg="rgba(52,211,153,0.12)" border="rgba(52,211,153,0.28)" /> : null}
                        <StatusPill label={sourceLabel(it.__source)} color={tone.color} bg={tone.bg} border={tone.border} />
                      </div>
                      <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1.4, color: "#fff5cf" }}>{title}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
                    <ArchiveMetaItem label="تاريخ الإنشاء" value={created} />
                    <ArchiveMetaItem label="عدد العناصر" value={count} />
                    <ArchiveMetaItem label="Run ID" value={String(it?.run?.runId || "—").slice(0, 18)} />
                    <ArchiveMetaItem label="المصدر" value={sourceLabel(it.__source)} />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={actionButton("brand")} onClick={() => restore(it)}>استعادة للجدول الشامل</button>
                    <button style={actionButton("danger")} onClick={() => remove(it)}>حذف</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
