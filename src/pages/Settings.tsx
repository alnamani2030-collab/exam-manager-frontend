import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRun, RUN_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import { loadTenantArray } from "../services/tenantData";
import { exportElementAsPdf } from "../lib/pdfExport";
import SettingsDistributionStatsSection from "../features/settings/components/SettingsDistributionStatsSection";

const EXAMS_KEY = "exam-manager:exams:v1";
const LOGO_KEY = "exam-manager:app-logo";
const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const WHATSAPP_ADMIN_KEY = "exam-manager:whatsapp-admin:v1";
const WHATSAPP_LAST_ALERT_KEY = "exam-manager:dist-stats:last-wa-alert:v1";

type Exam = {
  id: string;
  subject: string;
  dateISO: string;
  dayLabel?: string;
  period: "AM" | "PM";
  roomsCount: number;
  durationMinutes?: number;
};

function readJson<T = any>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dayNameArFromISO(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  const wd = dt.getUTCDay();
  return ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][wd] || "";
}

function formatPeriodAr(p: "AM" | "PM" | string) {
  return String(p || "").toUpperCase() === "PM" ? "الفترة الثانية" : "الفترة الأولى";
}

function normalizePhone(raw: string) {
  return String(raw || "").replace(/[^\d]/g, "");
}

function normalizePeriod(value: any): "AM" | "PM" {
  return String(value || "").toUpperCase() === "PM" ? "PM" : "AM";
}

function normalizeSubjectText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getRowSubject(row: any) {
  return normalizeSubjectText(
    row?.subject ??
      row?.examSubject ??
      row?.subjectName ??
      row?.examName ??
      row?.name ??
      ""
  );
}

function getRowDateISO(row: any) {
  return String(row?.dateISO ?? row?.date ?? "").trim();
}

function getRowPeriod(row: any): "AM" | "PM" {
  return normalizePeriod(row?.period ?? row?.periodKey ?? row?.p ?? "AM");
}

function getRowCommitteeNo(row: any) {
  const value =
    row?.committeeNo ??
    row?.committee ??
    row?.roomNo ??
    row?.room ??
    row?.committeeLabel ??
    row?.committeeNumber;
  if (value === undefined || value === null || value === "") return "";
  return String(value).trim();
}

export default function Settings() {
  const auth = useAuth() as any;
  const tenantId = String(auth?.tenantId || auth?.profile?.tenantId || "").trim();

  const [tick, setTick] = useState(0);
  const [isStatsFull, setIsStatsFull] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fsExams, setFsExams] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (!tenantId) {
          if (alive) setFsExams([]);
          return;
        }
        const rows = await loadTenantArray<any>(String(tenantId), "exams");
        if (alive) setFsExams(Array.isArray(rows) ? rows : []);
      } catch {
        if (alive) setFsExams([]);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [tenantId]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .distStats3D{
        position: relative;
        background: linear-gradient(145deg, #111111, #1a1a1a);
        border-radius: 16px;
        padding: 12px;
        box-shadow: 0 18px 35px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.05);
        overflow: visible;
      }

      .distStats3D::before{
        content:"";
        position:absolute;
        top:0;
        left:-120%;
        width:60%;
        height:100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: distShine 10s infinite;
        pointer-events:none;
      }

      @keyframes distShine{
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }

      .distTable{
        width:100%;
        min-width: 1200px;
        border-collapse: separate;
        border-spacing: 8px;
        color: rgba(255,255,255,0.95);
        font-size: 14px;
      }

      .distTh, .distTd{
        border-right: 3px solid rgba(184,134,11,0.95);
      }
      .distTh:last-child, .distTd:last-child{
        border-right:none;
      }

      .distTh{
        background: linear-gradient(180deg,#6e5200,#4a3600);
        color:#fff1c4;
        padding: 12px;
        border-radius: 12px;
        font-weight: 950;
        text-align:center;
        white-space: nowrap;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.2), 0 5px 12px rgba(0,0,0,0.6);
      }

      .distTd{
        background: linear-gradient(145deg,#181818,#101010);
        color:#d4af37;
        padding: 12px;
        border-radius: 14px;
        text-align:center;
        box-shadow: 0 8px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
        transition: transform .15s ease, box-shadow .15s ease;
      }

      .distTd:hover{
        transform: translateY(-3px);
        box-shadow: 0 14px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1);
      }

      .distColDate{
        min-width: 200px;
        font-weight: 950;
        background: linear-gradient(180deg,#7a5c00,#4a3600);
        color:#fff1c4;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.18), 0 10px 20px rgba(0,0,0,0.65);
      }

      .distColSubject{
        min-width: 220px;
        font-weight: 950;
        background: linear-gradient(180deg,#0f5132,#0a3622);
        color:#eafff3;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.14), 0 10px 20px rgba(0,0,0,0.65);
      }

      tr.row-deficit .distTd{
        outline: 1px solid rgba(255,77,77,0.35);
      }

      tr.row-big-deficit .distTd,
      .row-big-deficit .distTd,
      .row-big-deficit td{
        outline: 2px solid rgba(255,0,0,0.55) !important;
        animation: deficit-shake 700ms ease-in-out infinite !important;
        box-shadow: inset 0 0 0 1px rgba(255,0,0,0.25);
      }

      @keyframes deficit-shake {
        0%, 100% { transform: translateX(0); }
        10% { transform: translateX(-2px); }
        20% { transform: translateX(2px); }
        30% { transform: translateX(-3px); }
        40% { transform: translateX(3px); }
        50% { transform: translateX(-2px); }
        60% { transform: translateX(2px); }
        70% { transform: translateX(-1px); }
        80% { transform: translateX(1px); }
        90% { transform: translateX(-1px); }
      }

      @media print{
        .distStats3D{ box-shadow: none !important; }
        .distStats3D::before{ display:none !important; }
        .distTh, .distTd{ box-shadow:none !important; transform:none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        document.head.removeChild(style);
      } catch {}
    };
  }, []);

  useEffect(() => {
    const bump = () => setTick((x) => x + 1);

    const onRunUpdated = () => bump();
    const onStorage = (e: StorageEvent) => {
      const k = String(e.key || "");
      if (
        k.includes("exam-manager:task-distribution") ||
        k.includes("master-table") ||
        k.includes("all-table") ||
        k.includes("results-table") ||
        k === EXAMS_KEY
      ) {
        bump();
      }
    };

    window.addEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", bump);

    return () => {
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (isStatsFull) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isStatsFull]);

  const run = useMemo(() => {
    if (!tenantId) return null;
    try {
      const r = loadRun(String(tenantId));
      if (r && Array.isArray((r as any).assignments)) return r;
    } catch {}
    return null;
  }, [tenantId, tick]);

  const masterPayload = useMemo(() => {
    try {
      const raw = localStorage.getItem(MASTER_TABLE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      const rows = Array.isArray(p?.rows) ? p.rows : Array.isArray(p?.data) ? p.data : [];
      const meta = p?.meta || null;
      return { rows, meta };
    } catch {
      return null;
    }
  }, [tick]);

  const assignments = useMemo(() => {
    const fromMaster = Array.isArray(masterPayload?.rows) ? masterPayload!.rows : [];
    if (fromMaster.length > 0) {
      return { rows: fromMaster, source: "master-table", meta: masterPayload?.meta || null };
    }

    const fromRun = Array.isArray((run as any)?.assignments) ? (run as any).assignments : [];
    if (fromRun.length > 0) {
      return {
        rows: fromRun,
        source: "run",
        meta: { runId: (run as any)?.runId, runCreatedAtISO: (run as any)?.createdAtISO },
      };
    }

    return { rows: [], source: "none", meta: null };
  }, [run, masterPayload]);

  const branding = useMemo(() => {
    const logo = String(localStorage.getItem(LOGO_KEY) || "").trim();
    return { appName: "نظام إدارة الامتحانات الذكي", logo };
  }, [tick]);

  const exams = useMemo(() => {
    const primary = Array.isArray(fsExams) ? fsExams : [];
    const fallback = readJson<any[]>(EXAMS_KEY, []);
    const list = primary.length > 0 ? primary : Array.isArray(fallback) ? fallback : [];

    return list
      .map((e) => {
        const id = String(e?.id ?? e?._id ?? `${e?.dateISO ?? e?.date}-${e?.subject ?? ""}-${e?.period ?? ""}`);
        const dateISO = String(e?.dateISO ?? e?.date ?? "").trim();
        const subject = normalizeSubjectText(e?.subject ?? "");
        const period =
          (String(e?.period ?? e?.periodKey ?? e?.p ?? "AM").toUpperCase() === "PM" ? "PM" : "AM") as "AM" | "PM";
        const roomsCount = Number(e?.roomsCount ?? e?.rooms ?? e?.committees ?? 0) || 0;

        return {
          id,
          subject,
          dateISO,
          dayLabel: String(e?.dayLabel ?? e?.day ?? "") || undefined,
          period,
          roomsCount,
          durationMinutes: e?.durationMinutes != null ? Number(e.durationMinutes) : undefined,
        } as Exam;
      })
      .filter((e) => !!e.dateISO && !!e.subject);
  }, [fsExams, tick]);

  const reportRows = useMemo(() => {
    const rows = assignments.rows || [];

    const CONSTRAINTS_KEY = "exam-manager:task-distribution:constraints:v2";
    const constraintsRaw = (() => {
      try {
        return JSON.parse(String(localStorage.getItem(CONSTRAINTS_KEY) || "{}"));
      } catch {
        return {};
      }
    })();

    const inv_5_10 = Math.max(0, Number(constraintsRaw?.invigilators_5_10 ?? 0) || 0);
    const inv_11 = Math.max(0, Number(constraintsRaw?.invigilators_11 ?? 0) || 0);
    const inv_12 = Math.max(0, Number(constraintsRaw?.invigilators_12 ?? 0) || 0);

    const invigilatorsPerRoomForSubject = (subject: string) => {
      const s = String(subject || "");
      if (/\b11\b/.test(s) || s.includes("11")) return inv_11 || 2;
      if (/\b10\b/.test(s) || s.includes("10")) return inv_5_10 || 2;
      return inv_12 || 2;
    };

    // fallback من جدول الامتحانات: نفس المادة + التاريخ + الفترة
    const examsSummaryMap = new Map<
      string,
      { roomsCount: number; dayLabel?: string }
    >();

    for (const ex of exams) {
      const key = `${ex.dateISO}__${ex.period}__${normalizeSubjectText(ex.subject)}`;
      const prev = examsSummaryMap.get(key);
      examsSummaryMap.set(key, {
        roomsCount: Math.max(prev?.roomsCount || 0, Number(ex.roomsCount || 0)),
        dayLabel: prev?.dayLabel || ex.dayLabel,
      });
    }

    const computedFromExams = exams.map((ex) => {
      const invAssigned = rows.filter(
        (a: any) =>
          String(a?.taskType || "").toUpperCase() === "INVIGILATION" &&
          String(a?.examId || "") === String(ex.id)
      ).length;

      const reserveAssigned = rows.filter(
        (a: any) =>
          String(a?.taskType || "").toUpperCase() === "RESERVE" &&
          String(a?.dateISO || "") === String(ex.dateISO) &&
          normalizePeriod(a?.period || "") === ex.period
      ).length;

      const invPerRoom = invigilatorsPerRoomForSubject(ex.subject);
      const requiredTotal = Math.max(0, (Number(ex.roomsCount) || 0) * Math.max(0, Number(invPerRoom) || 0));
      const covered = invAssigned + reserveAssigned;
      const deficit = Math.max(0, requiredTotal - covered);
      const coveragePct = requiredTotal > 0 ? Math.round((covered / requiredTotal) * 100) : 100;
      const deficitWithoutReserve = Math.max(0, requiredTotal - invAssigned);
      const total = covered;

      return {
        ...ex,
        day: ex.dayLabel || dayNameArFromISO(ex.dateISO),
        periodLabel: formatPeriodAr(ex.period),
        invAssigned,
        reserveAssigned,
        invPerRoom,
        requiredTotal,
        deficitWithoutReserve,
        coveragePct,
        deficit,
        total,
      };
    });

    let computed = computedFromExams;

    if (rows.length > 0 && assignments.source === "master-table") {
      const grouped = new Map<string, any>();

      for (const row of rows as any[]) {
        const subject = normalizeSubjectText(getRowSubject(row));
        const dateISO = getRowDateISO(row);
        const period = getRowPeriod(row);

        if (!subject || !dateISO) continue;

        // ✅ بدون examId حتى لا تتكرر نفس المادة في نفس اليوم/الفترة
        const key = `${dateISO}__${period}__${subject}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            subject,
            dateISO,
            dayLabel: dayNameArFromISO(dateISO),
            period,
            committeeSet: new Set<string>(),
            invAssigned: 0,
          });
        }

        const item = grouped.get(key);
        const taskType = String(row?.taskType || "").toUpperCase();
        const committeeNo = getRowCommitteeNo(row);

        if (committeeNo) item.committeeSet.add(committeeNo);
        if (taskType === "INVIGILATION") item.invAssigned += 1;
      }

      const reserveByDatePeriod = new Map<string, number>();
      for (const row of rows as any[]) {
        const taskType = String(row?.taskType || "").toUpperCase();
        if (taskType !== "RESERVE") continue;

        const dateISO = getRowDateISO(row);
        const period = getRowPeriod(row);
        if (!dateISO) continue;

        const key = `${dateISO}__${period}`;
        reserveByDatePeriod.set(key, (reserveByDatePeriod.get(key) || 0) + 1);
      }

      computed = Array.from(grouped.values()).map((item: any) => {
        const fallbackKey = `${item.dateISO}__${item.period}__${item.subject}`;
        const fallbackExamSummary = examsSummaryMap.get(fallbackKey);

        const roomsFromAssignments = Math.max(0, item.committeeSet.size || 0);
        const roomsFromExams = Math.max(0, Number(fallbackExamSummary?.roomsCount || 0));

        // ✅ نأخذ الأكبر حتى لا تظهر القاعات = صفر
        const roomsCount = Math.max(roomsFromAssignments, roomsFromExams);

        const invPerRoom = invigilatorsPerRoomForSubject(item.subject);
        const requiredTotal = Math.max(0, roomsCount * Math.max(0, Number(invPerRoom) || 0));
        const reserveAssigned = reserveByDatePeriod.get(`${item.dateISO}__${item.period}`) || 0;
        const covered = item.invAssigned + reserveAssigned;
        const deficit = Math.max(0, requiredTotal - covered);
        const coveragePct = requiredTotal > 0 ? Math.round((covered / requiredTotal) * 100) : 100;
        const deficitWithoutReserve = Math.max(0, requiredTotal - item.invAssigned);
        const total = covered;

        return {
          id: item.key,
          subject: item.subject,
          dateISO: item.dateISO,
          dayLabel: fallbackExamSummary?.dayLabel || item.dayLabel,
          period: item.period,
          roomsCount,
          durationMinutes: undefined,
          day: (fallbackExamSummary?.dayLabel || item.dayLabel) || dayNameArFromISO(item.dateISO),
          periodLabel: formatPeriodAr(item.period),
          invAssigned: item.invAssigned,
          reserveAssigned,
          invPerRoom,
          requiredTotal,
          deficitWithoutReserve,
          coveragePct,
          deficit,
          total,
        };
      });
    }

    const toKey = (dateISO: string, period: "AM" | "PM") => {
      const d = String(dateISO || "").trim();
      const p = period === "PM" ? 1 : 0;
      return `${d}-${p}`;
    };

    const sorted = computed
      .slice()
      .sort((a: any, b: any) => {
        const ak = toKey(a.dateISO, a.period);
        const bk = toKey(b.dateISO, b.period);
        return ak.localeCompare(bk);
      });

    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [exams, assignments.rows, assignments.source, sortDir]);

  const totals = useMemo(() => {
    const t = { committees: 0, inv: 0, reserve: 0, deficit: 0, total: 0, requiredTotal: 0 };
    for (const r of reportRows as any[]) {
      t.committees += Number(r.roomsCount || 0) || 0;
      t.inv += Number(r.invAssigned || 0) || 0;
      t.reserve += Number(r.reserveAssigned || 0) || 0;
      t.deficit += Number(r.deficit || 0) || 0;
      t.total += Number(r.total || 0) || 0;
      t.requiredTotal += Number(r.requiredTotal || 0) || 0;
    }
    return t;
  }, [reportRows]);

  const totalDeficit = totals.deficit;
  const totalCoveragePct = totals.requiredTotal > 0 ? Math.round((totals.total / totals.requiredTotal) * 100) : 100;
  const BIG_DEFICIT_THRESHOLD = 4;

  const severeRows = useMemo(() => reportRows.filter((r: any) => (Number(r.deficit) || 0) >= BIG_DEFICIT_THRESHOLD), [reportRows]);
  const mediumRows = useMemo(
    () => reportRows.filter((r: any) => {
      const d = Number(r.deficit) || 0;
      return d > 0 && d < BIG_DEFICIT_THRESHOLD;
    }),
    [reportRows]
  );
  const lastRunHuman = useMemo(() => {
    if (!run?.createdAtISO) return "بانتظار تشغيل فعلي";
    try {
      return new Date(run.createdAtISO).toLocaleString("ar", { hour12: true });
    } catch {
      return String(run.createdAtISO);
    }
  }, [run]);
  const sourceLabelText =
    assignments.source === "master-table"
      ? "الجدول الشامل"
      : assignments.source === "run"
      ? "آخر تشغيل (Run)"
      : "لا توجد بيانات";

  const exportPDF = async () => {
    const el = document.getElementById("dist-stats-report");
    const title = "تقرير إحصائية التوزيع";

    if (!el) {
      await exportElementAsPdf({
        action: "settings_export_pdf",
        entity: "settings",
        title,
        subtitle: "",
        html: undefined,
        meta: { fallback: "window_print_no_element" },
      });
      return;
    }

    const html = `<!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body{font-family: Arial, Tahoma, sans-serif; margin:20px; color:#111;}
          .hdr{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;}
          .hdr-left{display:flex; align-items:center; gap:10px;}
          .logo{width:56px; height:56px; object-fit:contain;}
          .ttl{margin:0; font-size:18px; font-weight:700;}
          .sub{margin:2px 0 0 0; font-size:12px; color:#444;}
          .box{border:1px solid #ddd; border-radius:12px; padding:12px;}
          table{width:100%; border-collapse:collapse; font-size:12px;}
          th,td{border:1px solid #ddd; padding:6px; text-align:center;}
          th{background:#f3f3f3;}
        </style>
      </head>
      <body>
        <div class="hdr">
          <div class="hdr-left">
            <img class="logo" src="${localStorage.getItem("exam-manager:app-logo") || ""}" alt="logo" />
            <div>
              <p class="ttl">${title}</p>
              <p class="sub">${new Date().toLocaleString("ar")}</p>
            </div>
          </div>
        </div>
        <div class="box">${el.innerHTML}</div>
        <script>
          window.onload = function(){ setTimeout(function(){ window.print(); }, 50); };
        </script>
      </body>
      </html>`;

    await exportElementAsPdf({
      action: "settings_export_pdf",
      entity: "settings",
      title,
      subtitle: new Date().toLocaleString("ar"),
      html,
    });
  };

  const lastWhatsAppAlertRef = useRef<string>("");
  const topScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const adminPhone = normalizePhone(localStorage.getItem(WHATSAPP_ADMIN_KEY) || "");
    if (!adminPhone) return;

    const big = reportRows.filter((r: any) => (Number(r.deficit) || 0) >= BIG_DEFICIT_THRESHOLD);
    if (big.length === 0) {
      lastWhatsAppAlertRef.current = "";
      return;
    }

    const signature =
      String((run as any)?.runId || "") +
      "|" +
      String((run as any)?.createdAtISO || "") +
      "|" +
      big.map((r: any) => `${r.dateISO}-${r.period}-${r.subject}:${r.deficit}`).join(",");

    const stored = String(localStorage.getItem(WHATSAPP_LAST_ALERT_KEY) || "");
    if (signature === stored || signature === lastWhatsAppAlertRef.current) return;

    const lines = big
      .slice(0, 10)
      .map((r: any) => `• ${r.dateISO} (${r.day}) - ${r.subject} - ${r.periodLabel} | عجز: ${r.deficit}`)
      .join("\n");

    const msg =
      `تنبيه عاجل: يوجد عجز كبير في توزيع المراقبة.\n` +
      `إجمالي العجز: ${totalDeficit}\n\n` +
      `تفاصيل (أعلى 10):\n${lines}\n\n` +
      `يرجى مراجعة التوزيع والجدول الشامل.`;

    const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`;

    localStorage.setItem(WHATSAPP_LAST_ALERT_KEY, signature);
    lastWhatsAppAlertRef.current = signature;

    window.open(url, "_blank", "noopener,noreferrer");
  }, [reportRows, totalDeficit, run]);

  useEffect(() => {
    const top = topScrollRef.current;
    const topInner = topScrollInnerRef.current;
    const content = contentScrollRef.current;
    if (!top || !topInner || !content) return;

    let syncingTop = false;
    let syncingContent = false;

    const syncWidths = () => {
      topInner.style.width = `${content.scrollWidth}px`;
    };

    const onTopScroll = () => {
      if (syncingContent) {
        syncingContent = false;
        return;
      }
      syncingTop = true;
      content.scrollLeft = top.scrollLeft;
    };

    const onContentScroll = () => {
      if (syncingTop) {
        syncingTop = false;
        return;
      }
      syncingContent = true;
      top.scrollLeft = content.scrollLeft;
    };

    syncWidths();
    top.addEventListener("scroll", onTopScroll, { passive: true });
    content.addEventListener("scroll", onContentScroll, { passive: true });
    window.addEventListener("resize", syncWidths);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncWidths())
        : null;
    resizeObserver?.observe(content);

    return () => {
      top.removeEventListener("scroll", onTopScroll);
      content.removeEventListener("scroll", onContentScroll);
      window.removeEventListener("resize", syncWidths);
      resizeObserver?.disconnect();
    };
  }, [tick, isStatsFull, reportRows.length, totals.committees, totals.requiredTotal]);

  return (
    <div
      style={{
        padding: 20,
        direction: "rtl",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(212,175,55,0.16), transparent 24%), radial-gradient(circle at 85% 18%, rgba(59,130,246,0.10), transparent 22%), linear-gradient(180deg, #070707 0%, #0b0b0b 100%)",
        position: "relative",
        overflowX: "hidden",
        overflowY: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.20) 0%, rgba(212,175,55,0.05) 34%, transparent 72%)",
          filter: "blur(10px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -120,
          top: 220,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10), transparent 70%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1460, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div
          ref={topScrollRef}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            height: 14,
            marginBottom: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          title="شريط تمرير أفقي"
        >
          <div ref={topScrollInnerRef} style={{ height: 1 }} />
        </div>

        <div
          ref={contentScrollRef}
          style={{
            overflowX: "auto",
            overflowY: "visible",
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              minWidth: 1200,
              width: "max-content",
              maxWidth: "none",
              display: "grid",
              gap: 20,
            }}
          >
        <div
          style={{
            display: "grid",
            gap: 18,
            border: "1px solid rgba(212,175,55,0.18)",
            borderRadius: 34,
            padding: 28,
            background:
              "linear-gradient(135deg, rgba(30,22,2,0.94), rgba(8,8,8,0.96), rgba(27,21,3,0.94))",
            boxShadow:
              "0 32px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 14, maxWidth: 880 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                تقرير تنفيذي مباشر من بيانات التوزيع
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,241,196,0.88)", marginBottom: 10 }}>
                  {branding.appName}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(34px, 5vw, 64px)",
                    lineHeight: 1.05,
                    fontWeight: 950,
                    color: "#fff1c4",
                    letterSpacing: "-0.03em",
                    textShadow: "0 8px 28px rgba(212,175,55,0.16)",
                  }}
                >
                  مركز رقابة التوزيع
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 2,
                  color: "rgba(255,241,196,0.82)",
                  maxWidth: 900,
                }}
              >
                هذه الصفحة تمنح الإدارة رؤية تنفيذية فورية لحالة توزيع المراقبة من خلال مصدر البيانات الفعلي، وتعرض
                التغطية والعجز واللجان والحالات الحرجة في واجهة فاخرة ومنظمة تساعد على اتخاذ القرار بسرعة وثقة.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "مصدر التقرير", value: sourceLabelText },
                  { label: "آخر تشغيل", value: lastRunHuman },
                  { label: "حالة التغطية", value: `${totalCoveragePct}%` },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      borderRadius: 18,
                      padding: "12px 14px",
                      minWidth: 190,
                      boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#fff8dc", fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                minWidth: 300,
                maxWidth: 380,
                width: "100%",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
                padding: 22,
                background: "linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: totalDeficit > 0 ? "rgba(239,68,68,0.14)" : "rgba(16,185,129,0.14)",
                  border: totalDeficit > 0 ? "1px solid rgba(239,68,68,0.24)" : "1px solid rgba(16,185,129,0.24)",
                  color: totalDeficit > 0 ? "#fecaca" : "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {totalDeficit > 0 ? "يحتاج متابعة إدارية" : "الوضع مستقر"}
              </div>

              <div style={{ fontSize: 28, lineHeight: 1.5, fontWeight: 950, color: "#fff1c4" }}>
                {totalDeficit > 0
                  ? "العجز الحالي ظاهر ويحتاج إعادة توازن أو تدخل فوري."
                  : "لا يوجد عجز حرج حاليًا والتوزيع يعمل ضمن تغطية جيدة."}
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.95, color: "rgba(255,241,196,0.78)" }}>
                يتم هنا عرض الحالات الحرجة، والصفوف ذات النقص الكبير، ونسبة التغطية الكلية، مع إمكانية الفرز،
                التصدير إلى PDF، والتنبيه الإداري عبر واتساب.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14,
            }}
          >
            {[
              {
                label: "إجمالي اللجان",
                value: totals.committees,
                hint: "إجمالي اللجان/القاعات الفعلية",
                tone: "#fde68a",
              },
              {
                label: "المراقبون المسندون",
                value: totals.inv,
                hint: "التكليفات الفعلية للمراقبة",
                tone: "#93c5fd",
              },
              {
                label: "الاحتياط",
                value: totals.reserve,
                hint: "المسندون كاحتياط",
                tone: "#86efac",
              },
              {
                label: "إجمالي العجز",
                value: totalDeficit,
                hint: "العجز الكلي بعد الاحتياط",
                tone: totalDeficit > 0 ? "#fca5a5" : "#a7f3d0",
              },
              {
                label: "التغطية",
                value: `${totalCoveragePct}%`,
                hint: "نسبة التغطية الفعلية",
                tone: "#fff1c4",
              },
              {
                label: "الحالات الحرجة",
                value: severeRows.length,
                hint: `عجز ≥ ${BIG_DEFICIT_THRESHOLD}`,
                tone: severeRows.length ? "#fda4af" : "#c7f9cc",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 26,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
                  padding: 20,
                  boxShadow: "0 18px 44px rgba(0,0,0,0.26)",
                }}
              >
                <div style={{ fontSize: 13, color: "rgba(255,241,196,0.66)", fontWeight: 800 }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 36, fontWeight: 950, color: card.tone }}>{card.value}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,241,196,0.58)", lineHeight: 1.8 }}>{card.hint}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 22,
                padding: 16,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800, marginBottom: 6 }}>الحالات المتوسطة</div>
              <div style={{ fontSize: 22, color: "#fff7cc", fontWeight: 900 }}>{mediumRows.length}</div>
              <div style={{ fontSize: 12, color: "rgba(255,241,196,0.54)", lineHeight: 1.8, marginTop: 6 }}>
                حالات بها عجز محدود لكنها تحتاج مراجعة قبل الاعتماد النهائي.
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 22,
                padding: 16,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800, marginBottom: 6 }}>حالة الجدول</div>
              <div style={{ fontSize: 22, color: assignments.rows.length ? "#a7f3d0" : "#fecaca", fontWeight: 900 }}>
                {assignments.rows.length ? "مرتبط ببيانات فعلية" : "لا توجد بيانات"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,241,196,0.54)", lineHeight: 1.8, marginTop: 6 }}>
                يتم الاعتماد على الجدول الشامل أو آخر تشغيل محفوظ بحسب المتوفر.
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 22,
                padding: 16,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800, marginBottom: 6 }}>جاهزية القرار</div>
              <div style={{ fontSize: 22, color: totalDeficit > 0 ? "#fda4af" : "#bbf7d0", fontWeight: 900 }}>
                {totalDeficit > 0 ? "يتطلب تدخلًا" : "جاهز للاعتماد"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,241,196,0.54)", lineHeight: 1.8, marginTop: 6 }}>
                القراءة الحالية تساعد الإدارة على اعتماد التوزيع أو إعادة موازنته سريعًا.
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            flexWrap: "wrap",
            padding: "6px 0 2px",
          }}
        >
          <button
            onClick={() => setSortDir("asc")}
            style={{
              border: "1px solid rgba(212,175,55,0.28)",
              borderRadius: 16,
              padding: "12px 18px",
              background: sortDir === "asc"
                ? "linear-gradient(135deg, rgba(212,175,55,0.28), rgba(212,175,55,0.12))"
                : "rgba(255,255,255,0.04)",
              color: "#fff1c4",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: sortDir === "asc" ? "0 10px 24px rgba(212,175,55,0.16)" : "none",
            }}
          >
            فرز تصاعدي
          </button>

          <button
            onClick={() => setSortDir("desc")}
            style={{
              border: "1px solid rgba(212,175,55,0.28)",
              borderRadius: 16,
              padding: "12px 18px",
              background: sortDir === "desc"
                ? "linear-gradient(135deg, rgba(212,175,55,0.28), rgba(212,175,55,0.12))"
                : "rgba(255,255,255,0.04)",
              color: "#fff1c4",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: sortDir === "desc" ? "0 10px 24px rgba(212,175,55,0.16)" : "none",
            }}
          >
            فرز تنازلي
          </button>

          <button
            onClick={exportPDF}
            style={{
              border: "1px solid rgba(96,165,250,0.30)",
              borderRadius: 16,
              padding: "12px 18px",
              background: "rgba(96,165,250,0.10)",
              color: "#dbeafe",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            تصدير PDF
          </button>

          <button
            onClick={() => setIsStatsFull((v) => !v)}
            style={{
              border: "1px solid rgba(16,185,129,0.30)",
              borderRadius: 16,
              padding: "12px 18px",
              background: "rgba(16,185,129,0.10)",
              color: "#d1fae5",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {isStatsFull ? "إغلاق العرض الكامل" : "عرض كامل"}
          </button>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 30,
            padding: 18,
            background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))",
            boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 24, color: "#fff1c4", fontWeight: 950, marginBottom: 6 }}>
              تقرير التوزيع التنفيذي
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: "rgba(255,241,196,0.74)" }}>
              يعرض هذا القسم القراءة التفصيلية لحالة التغطية والعجز والاحتياط حسب الامتحان والفترة، مع إبراز
              الحالات الحرجة لتسهيل المتابعة الإدارية واتخاذ القرار.
            </div>
          </div>

          <SettingsDistributionStatsSection
            hasAssignments={assignments.rows.length > 0}
            isStatsFull={isStatsFull}
            totalDeficit={totalDeficit}
            totalCoveragePct={totalCoveragePct}
            reportRows={reportRows as any[]}
            totals={totals}
            bigDeficitThreshold={BIG_DEFICIT_THRESHOLD}
            whatsappAdminKey={WHATSAPP_ADMIN_KEY}
            onCloseFullscreen={() => setIsStatsFull(false)}
          />
        </div>
        </div>
      </div>
    </div>
    </div>
  );
}
