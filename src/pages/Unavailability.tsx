import React, { useEffect, useMemo, useState } from "react";
import { newId } from "../api/db";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray } from "../services/tenantData";

import {
  loadUnavailability,
  persistUnavailabilityToTenant,
  saveUnavailability,
  syncUnavailabilityFromTenant,
  type UnavailabilityBlock,
  type UnavailabilityPeriod,
  type UnavailabilityRule,
  UNAVAIL_UPDATED_EVENT,
} from "../utils/taskDistributionUnavailability";

const TEACHERS_SUB = "teachers";
const EXAMS_SUB = "exams";

const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type SchoolOfficialData = {
  name?: string;
  governorate?: string;
  semester?: string;
  phone?: string;
  address?: string;
};

function readSchoolOfficialData(): SchoolOfficialData {
  try {
    const raw = localStorage.getItem(SCHOOL_DATA_KEY);
    return raw ? (JSON.parse(raw) as SchoolOfficialData) : {};
  } catch {
    return {};
  }
}

function readSchoolOfficialLogo() {
  try {
    return localStorage.getItem(LOGO_KEY) || DEFAULT_LOGO_URL;
  } catch {
    return DEFAULT_LOGO_URL;
  }
}

function unavailabilityPad2(value: number) {
  return String(value).padStart(2, "0");
}

function unavailabilityLocalISODate(date = new Date()) {
  return `${date.getFullYear()}-${unavailabilityPad2(date.getMonth() + 1)}-${unavailabilityPad2(date.getDate())}`;
}

function unavailabilityNormalizeISODate(value: unknown) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${unavailabilityPad2(month)}-${unavailabilityPad2(day)}`;
    }
  }

  return "";
}

function unavailabilityAddDaysISO(isoDate: string, days: number) {
  const normalized = unavailabilityNormalizeISODate(isoDate);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return unavailabilityLocalISODate(date);
}

type PeriodChoice = UnavailabilityPeriod | "FULL_DAY";

type DisplayRule = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string;
  periodLabel: string;
  blocks: UnavailabilityBlock[];
  reason?: string;
  subject?: string;
  sourceIds: string[];
  sortPeriod: number;
};

const TEXT = {
  ar: {
    blocks: {
      ALL: "كل المهام",
      INVIGILATION: "مراقبة",
      RESERVE: "احتياط",
      REVIEW_FREE: "مراجعة",
      CORRECTION_FREE: "تصحيح",
    },
    title: "غياب الكادر التعليمي",
    subtitle: "يمنع المحرك من توزيع الكادر التعليمي في نفس التاريخ + الفترة للأنواع المحددة.",
    desc: "منصة تشغيلية فاخرة لضبط عدم التوفر قبل اعتماد التوزيع النهائي بدقة ووضوح.",
    teachersCount: "عدد المعلمين",
    currentRecords: "السجلات الحالية",
    selectedTeacher: "المعلم المحدد",
    addTitle: "إضافة سجل عدم توفر",
    addDesc: "سجّل الغياب أو عدم التوفر مع تحديد الفترة ونوع المنع قبل تشغيل محرك التوزيع ضمن واجهة أوضح وأكثر فخامة.",
    instantSave: "حفظ مباشر وربط فوري",
    teacher: "المعلم",
    date: "التاريخ",
    dateFrom: "التاريخ من",
    dateTo: "التاريخ إلى",
    subject: "مادة الامتحان",
    subjectPlaceholder: "— اختر مادة الامتحان —",
    noExamSubjects: "لا توجد مواد مستوردة من جدول الاختبارات.",
    period: "الفترة",
    periodAM: "الفترة الأولى (AM)",
    periodPM: "الفترة الثانية (PM)",
    fullDay: "كامل اليوم",
    blockedOn: "المنع على:",
    reason: "سبب (اختياري)",
    reasonPlaceholder: "مثال: دورة تدريبية / إجازة",
    add: "إضافة",
    noRecords: "لا توجد سجلات.",
    delete: "حذف",
    deleteConfirm: "حذف هذا السجل؟",
    deleteTitle: "تأكيد حذف سجل عدم التوفر",
    deleteMessage: "سيتم حذف هذا السجل من الصفحة ومن التخزين السحابي المرتبط بالجهة الحالية.",
    deleteWarning: "يرجى التأكد قبل التأكيد، لأن العملية لا يمكن التراجع عنها بعد الحذف.",
    confirmDelete: "تأكيد الحذف",
    cancel: "إلغاء",
    deleteSuccess: "تم حذف سجل عدم التوفر بنجاح.",
    duplicate: "يوجد سجل عدم توفر لهذا المعلم في نفس التاريخ",
    saveError: "تعذر حفظ عدم التوفر في بيانات الجهة الحالية.",
    deleteError: "تعذر حذف سجل عدم التوفر من بيانات الجهة الحالية.",
    none: "—",
    comma: "، ",
  },
  en: {
    blocks: {
      ALL: "All Tasks",
      INVIGILATION: "Invigilation",
      RESERVE: "Reserve",
      REVIEW_FREE: "Review",
      CORRECTION_FREE: "Correction",
    },
    title: "Teaching Staff Unavailability",
    subtitle: "The engine prevents assigning teaching staff on the same date + period for the selected types.",
    desc: "A premium operational interface to manage unavailability accurately and clearly before finalizing distribution.",
    teachersCount: "Teachers Count",
    currentRecords: "Current Records",
    selectedTeacher: "Selected Teacher",
    addTitle: "Add Unavailability Record",
    addDesc: "Record absence or unavailability by selecting the period and restriction type before running the distribution engine in a clearer premium interface.",
    instantSave: "Instant Save & Sync",
    teacher: "Teacher",
    date: "Date",
    dateFrom: "Date From",
    dateTo: "Date To",
    subject: "Exam Subject",
    subjectPlaceholder: "— Select Exam Subject —",
    noExamSubjects: "No subjects imported from the exams table.",
    period: "Period",
    periodAM: "First Period (AM)",
    periodPM: "Second Period (PM)",
    fullDay: "Full Day",
    blockedOn: "Blocked On:",
    reason: "Reason (Optional)",
    reasonPlaceholder: "Example: Training course / Leave",
    add: "Add",
    noRecords: "No records found.",
    delete: "Delete",
    deleteConfirm: "Delete this record?",
    deleteTitle: "Confirm unavailability record deletion",
    deleteMessage: "This record will be removed from the page and from the linked cloud storage for this tenant.",
    deleteWarning: "Please confirm carefully. This action cannot be undone after deletion.",
    confirmDelete: "Confirm delete",
    cancel: "Cancel",
    deleteSuccess: "Unavailability record deleted successfully.",
    duplicate: "An unavailability record already exists for this teacher on the same date",
    saveError: "Failed to save unavailability to the current tenant data.",
    deleteError: "Failed to delete the unavailability record from the current tenant data.",
    none: "—",
    comma: ", ",
  },
} as const;


function OfficialSchoolHeader({
  lang,
  data,
  logo,
}: {
  lang: "ar" | "en";
  data: SchoolOfficialData;
  logo: string;
}) {
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const schoolName = String(data?.name || tr("اسم المدرسة", "School Name")).trim();
  const governorate = String(data?.governorate || tr("المحافظة / المديرية", "Governorate / Directorate")).trim();
  return (
    <section className="schoolOfficialHeaderCard">
         
    </section>
  );
}


export default function Unavailability() {
  const { effectiveTenantId, user } = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tenantId = String(effectiveTenantId || "").trim();
  const t = TEXT[lang];

  const BLOCK_LABEL: Record<UnavailabilityBlock, string> = {
    ALL: t.blocks.ALL,
    INVIGILATION: t.blocks.INVIGILATION,
    RESERVE: t.blocks.RESERVE,
    REVIEW_FREE: t.blocks.REVIEW_FREE,
    CORRECTION_FREE: t.blocks.CORRECTION_FREE,
  };

  const [rules, setRules] = useState<UnavailabilityRule[]>(() => loadUnavailability(tenantId));
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [examSubjects, setExamSubjects] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [dateISO, setDateISO] = useState<string>(() => unavailabilityLocalISODate());
  const [dateToISO, setDateToISO] = useState<string>(() => unavailabilityLocalISODate());
  const [examSubject, setExamSubject] = useState<string>("");
  const [period, setPeriod] = useState<PeriodChoice>("AM");
  const [blocks, setBlocks] = useState<UnavailabilityBlock[]>(["INVIGILATION", "RESERVE"]);
  const [reason, setReason] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<DisplayRule | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [officialSchoolData, setOfficialSchoolData] = useState<SchoolOfficialData>(() => readSchoolOfficialData());
  const [officialLogo, setOfficialLogo] = useState<string>(() => readSchoolOfficialLogo());

  useEffect(() => {
    const refreshOfficialHeader = () => {
      setOfficialSchoolData(readSchoolOfficialData());
      setOfficialLogo(readSchoolOfficialLogo());
    };

    refreshOfficialHeader();
    window.addEventListener("exam-manager:changed", refreshOfficialHeader);
    window.addEventListener("storage", refreshOfficialHeader);

    return () => {
      window.removeEventListener("exam-manager:changed", refreshOfficialHeader);
      window.removeEventListener("storage", refreshOfficialHeader);
    };
  }, []);

  async function refreshRulesFromTenant(targetTenantId = tenantId) {
    const rows = await syncUnavailabilityFromTenant(targetTenantId).catch(() => loadUnavailability(targetTenantId));
    setRules(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    (async () => {
      if (!tenantId) {
        setTeachers([]);
        setExamSubjects([]);
        return;
      }

      const [teacherRows, examRows] = await Promise.all([
        loadTenantArray<any>(tenantId, TEACHERS_SUB).catch(() => []),
        loadTenantArray<any>(tenantId, EXAMS_SUB).catch(() => []),
      ]);

      const mappedTeachers = teacherRows
        .map((row: any) => {
          const id = String(row.id ?? "").trim();
          const name = String(row.fullName || row.name || row.employeeNo || "").trim();
          return { id, name };
        })
        .filter((row: any) => row.id && row.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en"));

      const subjects = Array.from(
        new Set(
          (Array.isArray(examRows) ? examRows : [])
            .map((row: any) =>
              String(
                row.subject ||
                  row.subjectName ||
                  row.subjectAr ||
                  row.material ||
                  row.materialName ||
                  row.examSubject ||
                  row.paperName ||
                  row.courseName ||
                  ""
              ).trim()
            )
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, lang === "ar" ? "ar" : "en"));

      setTeachers(mappedTeachers);
      setExamSubjects(subjects);
    })();
  }, [tenantId, lang]);

  useEffect(() => {
    if (!teacherId && teachers[0]?.id) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  const teacherName = useMemo(
    () => teachers.find((teacher) => teacher.id === teacherId)?.name || "",
    [teachers, teacherId]
  );

  const displayRules = useMemo<DisplayRule[]>(() => {
    const normalizeBlocksKey = (arr: UnavailabilityBlock[]) => [...(arr || [])].sort().join("|");
    const grouped = new Map<string, UnavailabilityRule[]>();

    for (const rule of rules) {
      const blocksKey = normalizeBlocksKey((rule.blocks?.length ? rule.blocks : ["ALL"]) as UnavailabilityBlock[]);
      const reasonKey = String(rule.reason || "").trim();
      const subjectKey = String((rule as any).examSubject || (rule as any).subject || "").trim();
      const key = [rule.teacherId, rule.teacherName, rule.dateISO, blocksKey, reasonKey, subjectKey].join("__");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(rule);
    }

    const out: DisplayRule[] = [];
    for (const group of grouped.values()) {
      const sorted = [...group].sort((a, b) => {
        const pa = a.period === "PM" ? 2 : 1;
        const pb = b.period === "PM" ? 2 : 1;
        return pa - pb || (a.createdAt || 0) - (b.createdAt || 0);
      });

      const first = sorted[0];
      const periods = new Set(sorted.map((x) => x.period));
      const hasAM = periods.has("AM");
      const hasPM = periods.has("PM");

      let periodLabel: string = t.periodAM;
      let sortPeriod = 1;
      if (hasAM && hasPM) {
        periodLabel = t.fullDay;
        sortPeriod = 0;
      } else if (hasPM) {
        periodLabel = t.periodPM;
        sortPeriod = 2;
      }

      out.push({
        id: first.id,
        teacherId: first.teacherId,
        teacherName: first.teacherName,
        dateISO: first.dateISO,
        periodLabel,
        blocks: (first.blocks?.length ? first.blocks : ["ALL"]) as UnavailabilityBlock[],
        reason: first.reason,
        subject: String((first as any).examSubject || (first as any).subject || "").trim(),
        sourceIds: sorted.map((x) => x.id),
        sortPeriod,
      });
    }

    return out.sort((a, b) => {
      const da = String(a.dateISO || "");
      const db = String(b.dateISO || "");
      if (da !== db) return da.localeCompare(db);
      if (a.sortPeriod !== b.sortPeriod) return a.sortPeriod - b.sortPeriod;
      return a.teacherName.localeCompare(b.teacherName, lang === "ar" ? "ar" : "en");
    });
  }, [rules, t, lang]);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "2px solid rgba(212,175,55,0.88)",
    background: "#fffdf7",
    color: "#111827",
    fontWeight: 900,
    fontSize: 15,
    padding: "10px 14px",
    outline: "none",
    boxSizing: "border-box",
    boxShadow: "0 8px 18px rgba(150,120,20,0.08)",
  };

  const dropdownStyle: React.CSSProperties = {
    ...fieldStyle,
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  };

  const dropdownOptionStyle: React.CSSProperties = {
    background: "#fffdf7",
    color: "#111827",
    fontWeight: 900,
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes floatUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .unavailOfficialPage {
        --school-gold: #d4af37;
        --school-green: #0f7a46;
        --school-blue: #2563eb;
        --school-red: #dc2626;
        --school-purple: #7c3aed;
        --school-orange: #ea580c;
        --school-ink: #111827;
        --school-muted: #374151;
      }

      .unavailOfficialPage * {
        box-sizing: border-box;
        text-shadow: none !important;
      }

      .schoolOfficialHeaderCard {
        background: linear-gradient(180deg, #fffdf7 0%, #f7f0df 100%);
        border: 3px solid rgba(212, 175, 55, 0.92);
        border-radius: 30px;
        padding: 18px;
        box-shadow: 0 0 0 6px rgba(212,175,55,0.09) inset, 0 14px 28px rgba(150,120,20,0.12);
        margin-bottom: 18px;
      }

      .schoolOfficialHeaderGrid {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) 112px;
        gap: 18px;
        align-items: center;
      }

      .schoolOfficialHeaderText {
        display: grid;
        gap: 5px;
      }

      .schoolOfficialHeaderText .country {
        font-size: clamp(18px, 2.4vw, 28px);
        line-height: 1.35;
        color: #0f172a;
        font-weight: 1000;
      }

      .schoolOfficialHeaderText .line {
        font-size: clamp(13px, 1.5vw, 18px);
        line-height: 1.55;
        color: #1f2937;
        font-weight: 900;
      }

      .schoolOfficialHeaderText .schoolName {
        font-size: clamp(16px, 1.9vw, 22px);
        line-height: 1.55;
        color: #0f172a;
        font-weight: 1000;
      }

      .schoolOfficialHeaderLogoBox {
        width: 96px;
        height: 96px;
        border-radius: 22px;
        border: 3px solid #d4af37;
        background: #fffef9;
        display: grid;
        place-items: center;
        justify-self: center;
        box-shadow: 0 10px 22px rgba(150,120,20,0.12);
      }

      .schoolOfficialHeaderLogoBox img {
        width: 72%;
        height: 72%;
        object-fit: contain;
      }


      @media (max-width: 900px) {
        .schoolOfficialHeaderGrid {
          grid-template-columns: 1fr !important;
          text-align: center;
        }

        .schoolOfficialHeaderLogoBox {
          justify-self: center;
        }
      }

      .header3d {
        position: relative;
        overflow: hidden;
        border-radius: 28px !important;
        background: linear-gradient(180deg, #fffdf7 0%, #f6edd7 100%) !important;
        border: 3px solid rgba(212,175,55,0.92) !important;
        box-shadow: 0 0 0 6px rgba(212,175,55,0.08) inset, 0 12px 26px rgba(150,120,20,0.12) !important;
        color: #111827 !important;
      }

      .shineOverlay {
        display: none !important;
      }

      .header3d div,
      .header3d span {
        color: #111827 !important;
        text-shadow: none !important;
      }

      .header3d > div {
        position: relative;
        padding-inline-start: 16px;
      }

      .header3d > div::before {
        content: "";
        position: absolute;
        inset-inline-start: 0;
        top: 4px;
        bottom: 4px;
        width: 6px;
        border-radius: 999px;
        background: linear-gradient(180deg, #d4af37, #16a34a);
      }

      .statCard {
        border: 2px solid #d4af37 !important;
        border-radius: 22px !important;
        padding: 16px 18px !important;
        background: linear-gradient(180deg, #fffdf7 0%, #f7f0df 100%) !important;
        box-shadow: 0 12px 24px rgba(150,120,20,0.10) !important;
      }

      .statCard:nth-child(2) {
        border-color: #2563eb !important;
        background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%) !important;
      }

      .statCard:nth-child(3) {
        border-color: #16a34a !important;
        background: linear-gradient(180deg, #f7fff9 0%, #effcf4 100%) !important;
      }

      .statCard div {
        color: #111827 !important;
        text-shadow: none !important;
      }

      .softBorder {
        border: 3px solid rgba(212,175,55,0.88) !important;
        border-radius: 28px !important;
        background: linear-gradient(180deg, #fffdf7 0%, #f7f0df 100%) !important;
        box-shadow: 0 14px 30px rgba(150,120,20,0.12) !important;
        color: #111827 !important;
      }

      .softBorder div,
      .softBorder span,
      .softBorder label {
        color: #111827 !important;
        text-shadow: none !important;
      }

      .softBorder label span {
        font-size: 14px;
        font-weight: 1000;
      }

      .goldBtn {
        background: linear-gradient(180deg, #dcfce7 0%, #86efac 100%) !important;
        border: 3px solid #16a34a !important;
        color: #065f46 !important;
        cursor: pointer;
        border-radius: 14px;
        padding: 10px 16px;
        font-weight: 1000;
        box-shadow: 0 10px 20px rgba(22,163,74,0.14) !important;
        transition: transform .12s ease, filter .12s ease;
      }

      .goldBtn:hover { transform: translateY(-1px); filter: brightness(1.03); }
      .dangerBtn { background: linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%) !important; border-color: #dc2626 !important; color: #991b1b !important; box-shadow: 0 10px 20px rgba(220,38,38,0.14) !important; }
      .goldBtn:active { transform: translateY(0px); filter: brightness(0.98); }

      .chip {
        border: 2px solid #d4af37 !important;
        border-radius: 999px;
        padding: 8px 14px;
        display: inline-flex;
        gap: 8px;
        align-items: center;
        background: #fff8e1 !important;
        color: #111827 !important;
        transition: transform .16s ease, border-color .16s ease, background .16s ease;
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(212,175,55,0.10);
      }

      .chip:nth-child(2) { border-color: #2563eb !important; background: #eef4ff !important; }
      .chip:nth-child(3) { border-color: #16a34a !important; background: #effcf4 !important; }
      .chip:nth-child(4) { border-color: #7c3aed !important; background: #f5f1ff !important; }
      .chip:nth-child(5) { border-color: #ea580c !important; background: #fff3eb !important; }

      .chip:hover {
        transform: translateY(-1px);
        background: #fffdf7 !important;
      }

      .card {
        border: 2px solid #d4af37 !important;
        border-radius: 22px !important;
        background: linear-gradient(180deg, #fffdf7 0%, #f7f0df 100%) !important;
        color: #111827 !important;
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }

      .card:nth-child(4n + 1) { border-color: #d4af37 !important; }
      .card:nth-child(4n + 2) { border-color: #2563eb !important; }
      .card:nth-child(4n + 3) { border-color: #16a34a !important; }
      .card:nth-child(4n + 4) { border-color: #7c3aed !important; }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 28px rgba(150,120,20,0.13) !important;
      }

      .card div,
      .card span {
        color: #111827 !important;
      }

      .unavail-record-title {
        color: #0f172a !important;
        font-size: 24px !important;
        font-weight: 1000 !important;
        text-shadow: none !important;
      }

      .unavailability-empty-state {
        color: #374151 !important;
        border: 2px dashed rgba(212,175,55,0.70) !important;
        border-radius: 18px !important;
        padding: 22px !important;
        background: #fffdf7 !important;
        font-weight: 900 !important;
      }

      .luxFade { animation: floatUp .45s ease; }

      @media (max-width: 980px) {
        .unavail-form-grid { grid-template-columns: 1fr !important; }
        .unavail-row-grid { grid-template-columns: 1fr !important; }
        .schoolOfficialHeaderGrid { grid-template-columns: 1fr !important; }
        .schoolOfficialHeaderMeta { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    void refreshRulesFromTenant(tenantId);
    const on = (event?: any) => {
      const eventTenantId = String(event?.detail?.tenantId ?? "").trim();
      if (eventTenantId && eventTenantId !== tenantId) return;
      setRules(loadUnavailability(tenantId));
    };
    window.addEventListener(UNAVAIL_UPDATED_EVENT, on as any);
    return () => window.removeEventListener(UNAVAIL_UPDATED_EVENT, on as any);
  }, [tenantId]);

  function toggleBlock(block: UnavailabilityBlock) {
    setBlocks((prev) => {
      const set = new Set(prev);
      if (block === "ALL") {
        return set.has("ALL") ? ([] as UnavailabilityBlock[]) : (["ALL"] as UnavailabilityBlock[]);
      }
      set.delete("ALL");
      if (set.has(block)) set.delete(block);
      else set.add(block);
      const out = Array.from(set);
      return out.length ? (out as UnavailabilityBlock[]) : (["INVIGILATION", "RESERVE"] as UnavailabilityBlock[]);
    });
  }

  function buildDateRange(fromISO: string, toISO: string) {
    const from = unavailabilityNormalizeISODate(fromISO);
    const to = unavailabilityNormalizeISODate(toISO || fromISO);
    if (!from || !to || to < from) return [];

    const out: string[] = [];
    let cursor = from;
    while (cursor && cursor <= to && out.length < 120) {
      out.push(cursor);
      cursor = unavailabilityAddDaysISO(cursor, 1);
    }
    return out;
  }

  async function onAdd() {
    const tid = String(teacherId || "").trim();
    const tname = String(teacherName || "").trim();
    const from = unavailabilityNormalizeISODate(dateISO);
    const to = unavailabilityNormalizeISODate(dateToISO || dateISO);
    const selectedSubject = String(examSubject || "").trim();
    const targetDates = buildDateRange(from, to);
    if (!tid || !tname || !from || !targetDates.length) return;

    const targetPeriods: UnavailabilityPeriod[] =
      period === "FULL_DAY" ? (["AM", "PM"] as UnavailabilityPeriod[]) : ([period] as UnavailabilityPeriod[]);

    const duplicates = targetDates.flatMap((targetDate) =>
      targetPeriods
        .filter((p) => rules.some((r) => r.teacherId === tid && r.dateISO === targetDate && r.period === p))
        .map((p) => `${targetDate} / ${p === "PM" ? t.periodPM : t.periodAM}`)
    );

    if (duplicates.length) {
      alert(`${t.duplicate}: ${duplicates.slice(0, 5).join("، ")}${duplicates.length > 5 ? " ..." : ""}.`);
      return;
    }

    const createdAt = Date.now();
    const createdRules: UnavailabilityRule[] = targetDates.flatMap((targetDate, dateIndex) =>
      targetPeriods.map((p, periodIndex) =>
        ({
          id: newId(),
          teacherId: tid,
          teacherName: tname,
          dateISO: targetDate,
          dateFromISO: from,
          dateToISO: to,
          period: p,
          examSubject: selectedSubject || undefined,
          subject: selectedSubject || undefined,
          blocks: blocks.length ? blocks : ["INVIGILATION", "RESERVE"],
          reason: reason.trim() || undefined,
          createdAt: createdAt + dateIndex * targetPeriods.length + periodIndex,
        } as UnavailabilityRule)
      )
    );

    const nextRules = [...createdRules, ...rules];
    saveUnavailability(nextRules, tenantId);
    setRules(nextRules);

    try {
      await persistUnavailabilityToTenant({
        tenantId,
        rules: nextRules,
        by: String(user?.uid || "").trim() || undefined,
      });
      setReason("");
      setPeriod("AM");
      setExamSubject("");
      setDateToISO(dateISO);
    } catch {
      await refreshRulesFromTenant(tenantId);
      alert(t.saveError);
    }
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget || deleteBusy) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    const idsToDelete = new Set(target.sourceIds || []);
    const nextRules = rules.filter((x) => !idsToDelete.has(x.id));

    saveUnavailability(nextRules, tenantId);
    setRules(nextRules);

    try {
      await persistUnavailabilityToTenant({
        tenantId,
        rules: nextRules,
        by: String(user?.uid || user?.email || "").trim() || undefined,
      });
      setDeleteNotice({ kind: "success", message: t.deleteSuccess });
      setDeleteTarget(null);
    } catch {
      await refreshRulesFromTenant(tenantId);
      setDeleteNotice({ kind: "error", message: t.deleteError });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div
      className="unavailOfficialPage"
      style={{
        padding: 18,
        direction: isRTL ? "rtl" : "ltr",
        background:
          "radial-gradient(circle at 12% 8%, rgba(212,175,55,0.13), transparent 24%), radial-gradient(circle at 88% 14%, rgba(16,185,129,0.10), transparent 26%), linear-gradient(180deg, #fffdf7 0%, #f4ecd8 54%, #fffaf0 100%)",
        minHeight: "100vh",
        color: "#111827",
        fontFamily: "Cairo, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <OfficialSchoolHeader
        lang={lang}
        data={officialSchoolData}
        logo={officialLogo}
      />

      <div
        className="header3d luxFade"
        style={{
          background: "linear-gradient(135deg, rgba(112,81,8,0.98), rgba(52,37,4,0.98), rgba(12,14,18,0.98))",
          border: "1px solid rgba(255, 215, 128, 0.22)",
          padding: "28px 28px",
          marginBottom: 20,
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 16px rgba(0,0,0,0.30), 0 0 30px rgba(212,175,55,0.10)",
        }}
      >
        <div className="shineOverlay" />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: "#fff1c4", textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>
              {t.title}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#ffffff", textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>
              {t.subtitle}
            </div>
            <div style={{ marginTop: 2, fontSize: 13, color: "#ffecbd", opacity: 0.96, textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>
              {t.desc}
            </div>
          </div>
        </div>
      </div>

      <div className="luxFade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: t.teachersCount, value: teachers.length || 0 },
          { label: t.currentRecords, value: rules.length || 0 },
          { label: t.selectedTeacher, value: teacherName || t.none },
        ].map((item) => (
          <div key={item.label} className="statCard">
            <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800 }}>{item.label}</div>
            <div style={{ marginTop: 8, fontSize: 18, color: "#fff8dc", fontWeight: 900 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="softBorder luxFade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 18, marginBottom: 20, boxShadow: "0 18px 38px rgba(0,0,0,0.20)" }}>
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff1c4", letterSpacing: "-0.02em" }}>{t.addTitle}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,241,196,0.70)", lineHeight: 1.8 }}>{t.addDesc}</div>
          </div>
          <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff1c4", fontWeight: 800, fontSize: 12 }}>
            {t.instantSave}
          </div>
        </div>

        <div className="unavail-form-grid" style={{ display: "contents" }} />

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.teacher}</span>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={dropdownStyle}>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id} style={dropdownOptionStyle}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.dateFrom}</span>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => {
              setDateISO(e.target.value);
              if (!dateToISO || dateToISO < e.target.value) setDateToISO(e.target.value);
            }}
            style={fieldStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.dateTo}</span>
          <input type="date" value={dateToISO} min={dateISO} onChange={(e) => setDateToISO(e.target.value)} style={fieldStyle} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.subject}</span>
          <select value={examSubject} onChange={(e) => setExamSubject(e.target.value)} style={dropdownStyle}>
            <option value="" style={dropdownOptionStyle}>{t.subjectPlaceholder}</option>
            {examSubjects.map((subject) => (
              <option key={subject} value={subject} style={dropdownOptionStyle}>{subject}</option>
            ))}
          </select>
          {!examSubjects.length ? <small style={{ color: "#92400e", fontWeight: 900 }}>{t.noExamSubjects}</small> : null}
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{t.period}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodChoice)} style={dropdownStyle}>
            <option value="AM" style={dropdownOptionStyle}>{t.periodAM}</option>
            <option value="PM" style={dropdownOptionStyle}>{t.periodPM}</option>
            <option value="FULL_DAY" style={dropdownOptionStyle}>{t.fullDay}</option>
          </select>
        </label>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ marginBottom: 8, fontWeight: 800 }}>{t.blockedOn}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {(Object.keys(BLOCK_LABEL) as UnavailabilityBlock[]).map((block) => {
              const checked = blocks.includes("ALL") ? block === "ALL" : blocks.includes(block);
              return (
                <label key={block} className="chip">
                  <input type="checkbox" checked={checked} onChange={() => toggleBlock(block)} />
                  <span>{BLOCK_LABEL[block]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
          <span>{t.reason}</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} style={fieldStyle} />
        </label>

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: isRTL ? "flex-end" : "flex-start" }}>
          <button onClick={onAdd} className="goldBtn">{t.add}</button>
        </div>
      </div>

      {deleteNotice ? (
        <div
          className="luxFade"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            margin: "0 0 18px",
            padding: "16px 18px",
            borderRadius: 18,
            border: deleteNotice.kind === "success" ? "2px solid #16a34a" : "2px solid #dc2626",
            background:
              deleteNotice.kind === "success"
                ? "linear-gradient(135deg, #ecfdf5, #dcfce7)"
                : "linear-gradient(135deg, #fff1f2, #fee2e2)",
            color: deleteNotice.kind === "success" ? "#064e3b" : "#7f1d1d",
            fontWeight: 900,
            boxShadow: "0 16px 30px rgba(15,23,42,0.12)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: deleteNotice.kind === "success" ? "#16a34a" : "#dc2626",
                color: "#fff",
                boxShadow: "0 10px 18px rgba(15,23,42,0.18)",
              }}
            >
              {deleteNotice.kind === "success" ? "✓" : "!"}
            </span>
            {deleteNotice.message}
          </span>
          <button
            type="button"
            onClick={() => setDeleteNotice(null)}
            style={{
              border: "0",
              borderRadius: 12,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 900,
              background: "rgba(255,255,255,0.75)",
              color: "#111827",
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 18,
            background: "rgba(15,23,42,0.50)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              borderRadius: 26,
              border: "2px solid #fecaca",
              background: "linear-gradient(180deg, #fff7ed, #fff1f2)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
              padding: 24,
              color: "#111827",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(180deg, #ef4444, #991b1b)",
                  color: "#fff",
                  fontSize: 26,
                  boxShadow: "0 16px 30px rgba(153,27,27,0.28)",
                }}
              >
                🗑️
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 950, color: "#7f1d1d" }}>{t.deleteTitle}</div>
                <div style={{ marginTop: 4, color: "#374151", fontWeight: 800 }}>{t.deleteMessage}</div>
              </div>
            </div>

            <div
              style={{
                margin: "16px 0",
                padding: 14,
                borderRadius: 18,
                border: "1px solid #fca5a5",
                background: "rgba(255,255,255,0.72)",
                fontWeight: 900,
                lineHeight: 1.8,
              }}
            >
              <div>{deleteTarget.teacherName}</div>
              <div style={{ color: "#4b5563" }}>
                {deleteTarget.dateISO} — {deleteTarget.periodLabel}
              </div>
            </div>

            <div style={{ color: "#92400e", fontWeight: 900, marginBottom: 18 }}>
              {t.deleteWarning}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: isRTL ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                style={{
                  border: "1px solid #d6b35a",
                  borderRadius: 14,
                  padding: "11px 18px",
                  cursor: deleteBusy ? "not-allowed" : "pointer",
                  fontWeight: 950,
                  background: "#fffaf0",
                  color: "#111827",
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={confirmDeleteTarget}
                disabled={deleteBusy}
                style={{
                  border: "0",
                  borderRadius: 14,
                  padding: "11px 18px",
                  cursor: deleteBusy ? "not-allowed" : "pointer",
                  fontWeight: 950,
                  background: deleteBusy ? "#9ca3af" : "linear-gradient(180deg, #ef4444, #b91c1c)",
                  color: "#fff",
                  boxShadow: "0 14px 26px rgba(185,28,28,0.28)",
                }}
              >
                {deleteBusy ? "..." : t.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="luxFade unavail-record-title" style={{ margin: "4px 0 14px", color: "#fff1c4", fontSize: 28, fontWeight: 900, textShadow: "0 4px 18px rgba(212,175,55,0.16)", letterSpacing: "-0.02em" }}>
        {t.currentRecords}
      </h2>

      {rules.length === 0 ? (
        <div className="luxFade unavailability-empty-state">
          {t.noRecords}
        </div>
      ) : (
        <div className="luxFade" style={{ display: "grid", gap: 12 }}>
          {displayRules.map((rule) => (
            <div key={rule.id} className="card unavail-row-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.7fr 1fr auto", gap: 14, alignItems: "center", padding: 16, boxShadow: "0 14px 28px rgba(0,0,0,0.18)" }}>
              <div style={{ fontWeight: 900 }}>{rule.teacherName}</div>
              <div>{rule.dateISO}</div>
              <div>{rule.periodLabel}</div>
              <div style={{ opacity: 0.95 }}>
                {(rule.blocks?.length ? rule.blocks : ["ALL"]).map((block) => BLOCK_LABEL[block as UnavailabilityBlock] || String(block)).join(t.comma)}
                {rule.subject ? <span style={{ opacity: 0.85 }}>{` — ${rule.subject}`}</span> : null}
                {rule.reason ? <span style={{ opacity: 0.75 }}>{` — ${rule.reason}`}</span> : null}
              </div>
              <button
                onClick={() => {
                  setDeleteNotice(null);
                  setDeleteTarget(rule);
                }}
                className="goldBtn dangerBtn"
                style={{ padding: "8px 10px" }}
              >
                {t.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
