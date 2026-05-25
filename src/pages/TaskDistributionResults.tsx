import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { pageDark, container, cardDark } from "../styles/ui";
import { subjectColors } from "./taskDistributionResults/constants";
import { ResultsPageHeader } from "./taskDistributionResults/components/ResultsPageHeader";
import { ResultsTable } from "./taskDistributionResults/components/ResultsTable";
import { ResultsEmptyRunState } from "./taskDistributionResults/components/ResultsEmptyRunState";
import { ResultsImportConfirmDialog } from "./taskDistributionResults/components/ResultsImportConfirmDialog";
import { ResultsFooterPanels } from "./taskDistributionResults/components/ResultsFooterPanels";
import { ResultsFullscreenToolbar } from "./taskDistributionResults/components/ResultsFullscreenToolbar";
import { getResultsTableHeaderStyles } from "./taskDistributionResults/services/resultsPageStyles";
import { useResultsRunSync } from "./taskDistributionResults/hooks/useResultsRunSync";
import { useResultsInteractionState } from "./taskDistributionResults/hooks/useResultsInteractionState";
import { useResultsDataModel } from "./taskDistributionResults/hooks/useResultsDataModel";
import { useResultsPageActions } from "./taskDistributionResults/hooks/useResultsPageActions";
import { useResultsTableActions } from "./taskDistributionResults/hooks/useResultsTableActions";
import { useResultsClipboardShortcuts } from "./taskDistributionResults/hooks/useResultsClipboardShortcuts";


const OFFICIAL_PAGE_STYLE: React.CSSProperties = {
  ...pageDark,
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(180, 142, 48, 0.18), transparent 34%), linear-gradient(135deg, #f7f0df 0%, #efe2c3 46%, #fbf7ee 100%)",
  color: "#111827",
  padding: "16px 10px",
};

const OFFICIAL_CARD_STYLE: React.CSSProperties = {
  ...cardDark,
  background: "linear-gradient(180deg, rgba(255, 253, 247, 0.98), rgba(246, 238, 218, 0.98))",
  border: "1px solid rgba(151, 116, 28, 0.55)",
  borderRadius: 18,
  boxShadow: "0 14px 30px rgba(78, 59, 16, 0.12), inset 0 1px 0 rgba(255,255,255,0.72)",
  color: "#111827",
};

const OFFICIAL_FULLSCREEN_LAYER_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background:
    "radial-gradient(circle at top left, rgba(180, 142, 48, 0.14), transparent 30%), linear-gradient(135deg, #f7f0df 0%, #efe2c3 52%, #fbf7ee 100%)",
  padding: 8,
  overflow: "auto",
};

const OFFICIAL_TEACHER_SEARCH_BAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  margin: "12px 0",
  padding: "10px 12px",
  border: "1px solid rgba(151, 116, 28, 0.42)",
  borderRadius: 16,
  background: "linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(239, 208, 118, 0.36))",
  boxShadow: "0 10px 24px rgba(78, 59, 16, 0.10)",
};

const OFFICIAL_TEACHER_SEARCH_INPUT_STYLE: React.CSSProperties = {
  minWidth: 260,
  maxWidth: "min(520px, 100%)",
  flex: "1 1 320px",
  height: 44,
  padding: "8px 14px",
  borderRadius: 14,
  border: "1px solid rgba(151, 116, 28, 0.62)",
  background: "#fffdf7",
  color: "#111827",
  fontWeight: 800,
  fontSize: 14,
  outline: "none",
};

const OFFICIAL_TEACHER_SEARCH_BUTTON_STYLE: React.CSSProperties = {
  height: 44,
  padding: "8px 18px",
  borderRadius: 14,
  border: "1px solid rgba(151, 116, 28, 0.62)",
  background: "linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%)",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(78, 59, 16, 0.12)",
};

const OFFICIAL_TEACHER_SEARCH_CLEAR_BUTTON_STYLE: React.CSSProperties = {
  ...OFFICIAL_TEACHER_SEARCH_BUTTON_STYLE,
  background: "linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%)",
};

const OFFICIAL_RESULTS_TABLE_CSS = `
  .resultsOfficialCommercialScope,
  .resultsOfficialCommercialScope * {
    box-sizing: border-box !important;
  }

  .resultsOfficialCommercialScope {
    color: #111827 !important;
  }

  .resultsOfficialCommercialScope input,
  .resultsOfficialCommercialScope select,
  .resultsOfficialCommercialScope textarea {
    background: #fffdf7 !important;
    color: #111827 !important;
    border: 1px solid #b89435 !important;
    border-radius: 10px !important;
    font-weight: 700 !important;
  }

  .resultsOfficialCommercialScope button {
    color: #111827 !important;
    border-color: rgba(151, 116, 28, 0.42) !important;
    font-weight: 800 !important;
  }

  .resultsOfficialCommercialScope table {
    width: 100% !important;
    background: #fffdf7 !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border: 1px solid #a98322 !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    box-shadow: 0 10px 24px rgba(78, 59, 16, 0.10) !important;
  }

  .resultsOfficialCommercialScope table thead th,
  .resultsOfficialCommercialScope table tfoot th,
  .resultsOfficialCommercialScope table tfoot td {
    background: linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%) !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    border: 1px solid rgba(120, 89, 14, 0.58) !important;
    font-size: 12px !important;
    font-weight: 850 !important;
    line-height: 1.28 !important;
    padding: 6px 7px !important;
    text-align: center !important;
    vertical-align: middle !important;
    white-space: normal !important;
  }

  .resultsOfficialCommercialScope table tbody td {
    background: #fffaf0 !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    border: 1px solid rgba(151, 116, 28, 0.34) !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    line-height: 1.28 !important;
    padding: 4px 6px !important;
    vertical-align: top !important;
    height: auto !important;
    min-height: 0 !important;
  }

  .resultsOfficialCommercialScope table tbody tr:nth-child(even) td:not(.resultsOfficialInvigilationCell):not(.resultsOfficialReserveCell):not(.resultsOfficialDutyCell):not(.resultsOfficialEmptyCell) {
    background: #f8efd8 !important;
  }

  .resultsOfficialCommercialScope table tbody tr:hover td:not(.resultsOfficialInvigilationCell):not(.resultsOfficialReserveCell):not(.resultsOfficialDutyCell):not(.resultsOfficialEmptyCell) {
    background: #f2e4bd !important;
  }

  .resultsOfficialCommercialScope table tbody td > div,
  .resultsOfficialCommercialScope table tbody td > section,
  .resultsOfficialCommercialScope table tbody td > article {
    max-width: 100% !important;
    margin: 0 !important;
  }

  .resultsOfficialCommercialScope table tbody td button,
  .resultsOfficialCommercialScope table tbody td [role="button"] {
    min-height: 0 !important;
    padding: 4px 8px !important;
    margin: 2px !important;
    border-radius: 10px !important;
    font-size: 12px !important;
    line-height: 1.2 !important;
    box-shadow: none !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialInvigilationCell,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialReserveCell,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialDutyCell,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialEmptyCell {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-weight: 800 !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialInvigilationCell {
    background: linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%) !important;
    border-color: rgba(29, 78, 216, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 10px rgba(37, 99, 235, 0.16) !important;
    animation: resultsOfficialBluePulse 2.4s ease-in-out infinite !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialReserveCell {
    background: linear-gradient(180deg, #dcfce7 0%, #86efac 100%) !important;
    border-color: rgba(21, 128, 61, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 10px rgba(22, 163, 74, 0.16) !important;
    animation: resultsOfficialGreenPulse 2.4s ease-in-out infinite !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialDutyCell {
    background: linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%) !important;
    border-color: rgba(185, 28, 28, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 10px rgba(220, 38, 38, 0.16) !important;
    animation: resultsOfficialRedPulse 2.4s ease-in-out infinite !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialEmptyCell,
  .resultsOfficialCommercialScope table tbody td:empty {
    background: linear-gradient(180deg, #fff6cf 0%, #efd076 100%) !important;
    border-color: rgba(151, 116, 28, 0.56) !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialInvigilationCell *,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialReserveCell *,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialDutyCell *,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialEmptyCell * {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    text-shadow: none !important;
  }

  @keyframes resultsOfficialBluePulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 6px rgba(37, 99, 235, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.70), 0 0 14px rgba(37, 99, 235, 0.25); }
  }

  @keyframes resultsOfficialGreenPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 6px rgba(22, 163, 74, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.70), 0 0 14px rgba(22, 163, 74, 0.25); }
  }

  @keyframes resultsOfficialRedPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 6px rgba(220, 38, 38, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.70), 0 0 14px rgba(220, 38, 38, 0.25); }
  }

  @media print {
    .resultsOfficialCommercialScope,
    .resultsOfficialCommercialScope * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      text-shadow: none !important;
      animation: none !important;
      box-shadow: none !important;
    }

    .resultsOfficialCommercialScope {
      background: #ffffff !important;
      padding: 0 !important;
    }

    .resultsOfficialCommercialScope table {
      border-radius: 0 !important;
      box-shadow: none !important;
    }
  }
`;

const OFFICIAL_CELL_CLASS_NAMES = [
  "resultsOfficialInvigilationCell",
  "resultsOfficialReserveCell",
  "resultsOfficialDutyCell",
  "resultsOfficialEmptyCell",
];

function cleanCommercialCellText(value: string) {
  return String(value || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCommercialTeacherSearch(value: string) {
  return cleanCommercialCellText(String(value || ""))
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ـ_\-.،,;:()\[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isCommercialEmptyActionText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanCommercialCellText(raw).toLowerCase();

  return (
    !text ||
    text === "—" ||
    text === "-" ||
    /^\+/.test(raw) ||
    /(^|\s)(اضافة|إضافة|add)(\s|$)/i.test(raw) ||
    /فاضي|للمراجعة|للتصحيح|review|correction/.test(text)
  );
}

function getCommercialCellClassFromText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanCommercialCellText(raw).toLowerCase();

  if (isCommercialEmptyActionText(raw)) return "resultsOfficialEmptyCell";
  if (/مراقب\s*دور|duty\s*invigilator/.test(text)) return "resultsOfficialDutyCell";
  if (/(^|\s)(احتياط|reserve)(\s|$)/.test(text)) return "resultsOfficialReserveCell";
  if (/مراقبة|invigilation/.test(text)) return "resultsOfficialInvigilationCell";

  return "";
}

function applyCommercialResultsCellClasses(root: HTMLElement | null) {
  if (!root) return;

  const cells = Array.from(root.querySelectorAll<HTMLElement>("tbody td"));

  cells.forEach((cell) => {
    OFFICIAL_CELL_CLASS_NAMES.forEach((className) => cell.classList.remove(className));

    const text = cell.textContent || "";
    const cellClass = getCommercialCellClassFromText(text);
    const hasActionButton = Array.from(cell.querySelectorAll<HTMLElement>("button, [role='button']")).some((button) =>
      isCommercialEmptyActionText(button.textContent || ""),
    );

    if (cellClass) {
      cell.classList.add(cellClass);
      return;
    }

    if (hasActionButton || cleanCommercialCellText(text) === "") {
      cell.classList.add("resultsOfficialEmptyCell");
    }
  });
}

function normalizeSubject(subject: string) {
  return String(subject || "").replace(/\s+/g, " ").trim();
}

function getCommitteeNo(a: any) {
  const value = a?.committeeNo ?? a?.committee ?? a?.roomNo ?? a?.room;
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function getSubjectBackground(subject?: string) {
  const normalized = normalizeSubject(String(subject || ""));
  return subjectColors[normalized] || "rgba(212,175,55,0.18)";
}

function getTenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId || auth?.profile?.tenantId || auth?.userProfile?.tenantId || auth?.user?.tenantId || "default",
    ).trim() || "default"
  );
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const auth = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tenantId = React.useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const printAreaRef = React.useRef<HTMLDivElement>(null);
  const [showTeacherSidebar, setShowTeacherSidebar] = React.useState(true);
  const [teacherSearchInput, setTeacherSearchInput] = React.useState("");
  const [teacherSearchTerm, setTeacherSearchTerm] = React.useState("");

  const formatPeriod = React.useCallback(
    (period?: string) => {
      const p = String(period || "AM").toUpperCase();
      return p === "PM" || p === "BM" ? tr("الفترة الثانية", "Second Period") : tr("الفترة الأولى", "First Period");
    },
    [tr],
  );

  const taskLabel = React.useCallback(
    (taskType: any) => {
      switch (String(taskType || "")) {
        case "INVIGILATION":
          return tr("مراقبة", "Invigilation");
        case "RESERVE":
          return tr("احتياط", "Reserve");
        case "REVIEW_FREE":
          return tr("فاضي للمراجعة", "Free for review");
        case "CORRECTION_FREE":
          return tr("فاضي للتصحيح", "Free for correction");
        case "DUTY_INVIGILATOR":
          return tr("مراقب دور", "Duty Invigilator");
        default:
          return tr("مهمة", "Task");
      }
    },
    [tr],
  );

  const formatDateWithDay = React.useCallback(
    (dateISO: string) => {
      const value = String(dateISO || "").trim();
      if (!value) return { day: "—", full: "—", line: "—" };

      const d = new Date(`${value}T00:00:00`);
      if (Number.isNaN(d.getTime())) return { day: value, full: value, line: value };

      const locale = lang === "ar" ? "ar" : "en";
      const day = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
      const full = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

      return { day, full, line: `${day} ${full}` };
    },
    [lang],
  );

  const { run, setRun } = useResultsRunSync(tenantId);
  const interaction = useResultsInteractionState(tenantId);
  const dataModel = useResultsDataModel({ tenantId, run, normalizeSubject });

  const activeTeacherSearch = React.useMemo(() => normalizeCommercialTeacherSearch(teacherSearchTerm), [teacherSearchTerm]);

  const visibleTeachers = React.useMemo(() => {
    if (!activeTeacherSearch) return dataModel.allTeachers;

    return dataModel.allTeachers.filter((teacher) =>
      normalizeCommercialTeacherSearch(String(teacher || "")).includes(activeTeacherSearch),
    );
  }, [dataModel.allTeachers, activeTeacherSearch]);

  const applyTeacherSearch = React.useCallback(() => {
    setTeacherSearchTerm(teacherSearchInput);
  }, [teacherSearchInput]);

  const clearTeacherSearch = React.useCallback(() => {
    setTeacherSearchInput("");
    setTeacherSearchTerm("");
  }, []);

  const pageActions = useResultsPageActions({
    tenantId,
    run,
    setRun,
    setUndoStack: interaction.setUndoStack,
    fileInputRef: interaction.fileInputRef,
    printAreaRef,
    pendingImported: interaction.pendingImported,
    setPendingImported: interaction.setPendingImported,
    pendingImportedFilename: interaction.pendingImportedFilename,
    setPendingImportedFilename: interaction.setPendingImportedFilename,
    setImportDialogOpen: interaction.setImportDialogOpen,
    importError: interaction.importError,
    setImportError: interaction.setImportError,
    onArchived: () => nav("/archive"),
  });

  const tableActions = useResultsTableActions({
    tenantId,
    run,
    teacherNameToId: dataModel.teacherNameToId,
    colKeyToExamId: dataModel.colKeyToExamId,
    examKeyToCommittees: dataModel.examKeyToCommittees,
    invigilatorsPerRoomForSubject: dataModel.invigilatorsPerRoomForSubject,
    unavailIndex: interaction.unavailIndex,
    unavailReasonMap: interaction.unavailReasonMap,
    markCellBlocked: interaction.markCellBlocked,
    normalizeSubject,
    persistEditedAssignments: pageActions.persistEditedAssignments,
    displayDates: dataModel.displayDates,
    dateToSubCols: dataModel.dateToSubCols,
    allSubCols: dataModel.allSubCols,
    allTeachers: dataModel.allTeachers,
    matrix2: dataModel.matrix2,
    committeesCountBySubCol: dataModel.committeesCountBySubCol,
    totalsDetailBySubCol: dataModel.totalsDetailBySubCol,
    teacherTotals: dataModel.teacherTotals,
  });

  const getAssignmentsInCell = React.useCallback(
    (teacher: string, subColKey: string) =>
      tableActions.getAssignmentsInCell(run?.assignments || [], teacher, subColKey, normalizeSubject),
    [run, tableActions],
  );

  useResultsClipboardShortcuts({
    selectedCell: interaction.selectedCell,
    clipboardUid: interaction.clipboardUid,
    setClipboardUid: interaction.setClipboardUid,
    run,
    getAssignmentsInCell,
    swapAssignmentsByUid: tableActions.swapAssignmentsByUid,
    moveAssignmentToColumnTeacher: tableActions.moveAssignmentToColumnTeacher,
    isDraggableTaskType: tableActions.isDraggableTaskType,
  });

  const columnColor = React.useCallback((index: number) => {
    const tones = [
      { colBg: "rgba(2,132,199,.14)", headBg: "rgba(2,132,199,.22)" },
      { colBg: "rgba(99,102,241,.14)", headBg: "rgba(99,102,241,.22)" },
      { colBg: "rgba(168,85,247,.14)", headBg: "rgba(168,85,247,.22)" },
      { colBg: "rgba(34,197,94,.14)", headBg: "rgba(34,197,94,.22)" },
    ];
    return tones[index % tones.length];
  }, []);

  const teacherRowColor = React.useCallback((index: number) => ({
    stripe: ["#38bdf8", "#c084fc", "#22c55e", "#f59e0b", "#ef4444"][index % 5],
  }), []);

  const styles = React.useMemo(() => {
    const officialHeaderStylesInput: Parameters<
      typeof getResultsTableHeaderStyles
    >[0] = {
      tableText: "#111827",
      tableFontSize: "12px",
      goldLine: "#a98322",
      goldLineSoft: "rgba(151, 116, 28, 0.34)",
    };

    return {
      ...officialHeaderStylesInput,
      ...getResultsTableHeaderStyles(officialHeaderStylesInput),
    };
  }, []);

  const hasRun = Boolean(run && Array.isArray(run.assignments) && run.assignments.length);

  const teacherSearchControls = hasRun ? (
    <div style={OFFICIAL_TEACHER_SEARCH_BAR_STYLE}>
      <strong style={{ color: "#111827", fontWeight: 900 }}>
        {tr("بحث في أسماء المعلمين", "Search teacher names")}
      </strong>
      <input
        type="search"
        value={teacherSearchInput}
        placeholder={tr("اكتب اسم المعلم هنا", "Type teacher name here")}
        aria-label={tr("بحث باسم المعلم", "Search by teacher name")}
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={OFFICIAL_TEACHER_SEARCH_INPUT_STYLE}
        onChange={(event) => setTeacherSearchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") applyTeacherSearch();
        }}
      />
      <button type="button" style={OFFICIAL_TEACHER_SEARCH_BUTTON_STYLE} onClick={applyTeacherSearch}>
        {tr("بحث", "Search")}
      </button>
      <button type="button" style={OFFICIAL_TEACHER_SEARCH_CLEAR_BUTTON_STYLE} onClick={clearTeacherSearch}>
        {tr("إظهار الكل", "Show all")}
      </button>
      <span style={{ color: "#374151", fontWeight: 800 }}>
        {activeTeacherSearch
          ? tr(`المعروض: ${visibleTeachers.length} من ${dataModel.allTeachers.length}`, `Showing: ${visibleTeachers.length} of ${dataModel.allTeachers.length}`)
          : tr(`عدد المعلمين: ${dataModel.allTeachers.length}`, `Teachers: ${dataModel.allTeachers.length}`)}
      </span>
    </div>
  ) : null;

  React.useEffect(() => {
    if (!hasRun) return;

    const apply = () => applyCommercialResultsCellClasses(printAreaRef.current);
    const frame = window.requestAnimationFrame(apply);

    if (typeof MutationObserver === "undefined" || !printAreaRef.current) {
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new MutationObserver(() => apply());
    observer.observe(printAreaRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [hasRun, run, dataModel.allSubCols.length, visibleTeachers.length, showTeacherSidebar, interaction.tableFullScreen]);

  const content = !hasRun ? (
    <ResultsEmptyRunState
      importError={interaction.importError}
      fileInputRef={interaction.fileInputRef}
      onBack={() => nav("/task-distribution/run")}
      onPickImportFile={pageActions.handlePickImportFile}
      onImportFileSelected={pageActions.handleImportFileSelected}
    />
  ) : (
    <>
      {!interaction.tableFullScreen ? (
        <div style={OFFICIAL_CARD_STYLE}>
          <ResultsPageHeader
            runId={String(run?.runId || "—")}
            createdAtISO={run?.createdAtISO}
            importError={interaction.importError || undefined}
            tableFullScreen={interaction.tableFullScreen}
            undoDisabled={!interaction.undoStack.length}
            onGoHome={() => nav("/task-distribution/run")}
            onPickImportFile={pageActions.handlePickImportFile}
            onExportPdf={pageActions.handleExportPdf}
            onArchiveSnapshot={pageActions.handleArchiveSnapshot}
            onToggleFullscreen={() => interaction.setTableFullScreen(!interaction.tableFullScreen)}
            onUndo={() => pageActions.handleUndo(interaction.undoStack)}
            onExportExcel={tableActions.exportExcel}
            onPrintTableOnly={pageActions.handlePrintTableOnly}
            showTeacherSidebar={showTeacherSidebar}
            onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
          />
        </div>
      ) : null}

      {teacherSearchControls}

      <div ref={printAreaRef}>
        <ResultsTable
          displayDates={dataModel.displayDates}
          dateToSubCols={dataModel.dateToSubCols}
          allSubCols={dataModel.allSubCols}
          allTeachers={visibleTeachers}
          matrix2={dataModel.matrix2}
          committeesCountBySubCol={dataModel.committeesCountBySubCol}
          totalsDetailBySubCol={dataModel.totalsDetailBySubCol}
          teacherTotals={dataModel.teacherTotals}
          columnColor={columnColor}
          teacherRowColor={teacherRowColor}
          getSubjectBackground={getSubjectBackground}
          taskLabel={taskLabel}
          normalizeSubject={normalizeSubject}
          formatPeriod={formatPeriod}
          getCommitteeNo={getCommitteeNo}
          isDraggableTaskType={tableActions.isDraggableTaskType}
          dragSrcUid={interaction.dragSrcUid}
          dragOverUid={interaction.dragOverUid}
          setDragSrcUid={interaction.setDragSrcUid}
          setDragOverUid={interaction.setDragOverUid}
          onSwap={tableActions.swapAssignmentsByUid}
          onDropToEmpty={tableActions.handleDropToEmptyCell}
          onDropToCell={tableActions.handleDropToCell}
          onAddToEmpty={tableActions.addTaskToEmptyCell}
          onDeleteByUid={tableActions.deleteAssignmentByUid}
          onDeleteSubCol={tableActions.deleteAssignmentsBySubCol}
          styles={styles as any}
          formatDateWithDayAr={formatDateWithDay}
          containerMaxHeight={interaction.tableFullScreen ? "calc(100vh - 120px)" : "72vh"}
          selectedCell={interaction.selectedCell}
          onSelectCell={interaction.setSelectedCell}
          isConflictUid={(uid) => dataModel.conflictUids.has(uid)}
          getUnavailabilityReasonForCell={tableActions.getUnavailabilityReasonForCell}
          blockedCellMsg={interaction.blockedCellMsg}
          showTeacherSidebar={showTeacherSidebar}
        />

        <div style={{ marginTop: 16 }}>
          <ResultsFooterPanels
            warnings={dataModel.warnings}
            assignmentsCount={dataModel.assignments.length}
            daysCount={dataModel.displayDates.length}
            columnsCount={dataModel.allSubCols.length}
            teachersCount={visibleTeachers.length}
          />
        </div>
      </div>
    </>
  );

  const sharedImportControls = (
    <>
      <input
        ref={interaction.fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: "none" }}
        onChange={pageActions.handleImportFileSelected}
      />

      <ResultsImportConfirmDialog
        open={interaction.importDialogOpen}
        filename={interaction.pendingImportedFilename}
        onConfirm={pageActions.confirmImportReplace}
        onCancel={pageActions.closeImportDialog}
      />
    </>
  );

  if (interaction.tableFullScreen && hasRun) {
    return (
      <div className="resultsOfficialCommercialScope" style={{ ...OFFICIAL_PAGE_STYLE, padding: 8 }}>
        <style>{OFFICIAL_RESULTS_TABLE_CSS}</style>
        <div style={OFFICIAL_FULLSCREEN_LAYER_STYLE}>
          <div style={{ ...container, width: "100%", maxWidth: "100%", padding: 0 }}>
            <ResultsFullscreenToolbar
              undoDisabled={!interaction.undoStack.length}
              onUndo={() => pageActions.handleUndo(interaction.undoStack)}
              onClose={() => interaction.setTableFullScreen(false)}
              showTeacherSidebar={showTeacherSidebar}
              onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
            />
            {sharedImportControls}
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resultsOfficialCommercialScope" style={OFFICIAL_PAGE_STYLE}>
      <style>{OFFICIAL_RESULTS_TABLE_CSS}</style>
      <div style={{ ...container, width: "min(1880px, 100%)", maxWidth: "100%" }}>
        {sharedImportControls}
        {content}
      </div>
    </div>
  );
}
