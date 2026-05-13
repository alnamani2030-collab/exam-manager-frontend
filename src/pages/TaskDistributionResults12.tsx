import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { container } from "../styles/ui";
import { subjectColors } from "./taskDistributionResults12/constants";
import { ResultsPageHeader } from "./taskDistributionResults12/components/ResultsPageHeader";
import { ResultsTable } from "./taskDistributionResults12/components/ResultsTable";
import { ResultsEmptyRunState } from "./taskDistributionResults12/components/ResultsEmptyRunState";
import { ResultsImportConfirmDialog } from "./taskDistributionResults12/components/ResultsImportConfirmDialog";
import { ResultsFooterPanels } from "./taskDistributionResults12/components/ResultsFooterPanels";
import { ResultsFullscreenToolbar } from "./taskDistributionResults12/components/ResultsFullscreenToolbar";
import { getResultsTableHeaderStyles } from "./taskDistributionResults12/services/resultsPageStyles";
import { useResultsRunSync } from "./taskDistributionResults12/hooks/useResultsRunSync";
import { useResultsInteractionState } from "./taskDistributionResults12/hooks/useResultsInteractionState";
import { useResultsDataModel } from "./taskDistributionResults12/hooks/useResultsDataModel";
import { useResultsPageActions } from "./taskDistributionResults12/hooks/useResultsPageActions";
import { useResultsTableActions } from "./taskDistributionResults12/hooks/useResultsTableActions";
import { useResultsClipboardShortcuts } from "./taskDistributionResults12/hooks/useResultsClipboardShortcuts";

const OFFICIAL_PAGE_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f7f1e4 0%, #eee2c9 100%)",
  color: "#111827",
  padding: "12px 8px",
};

const OFFICIAL_PANEL_STYLE: React.CSSProperties = {
  background: "rgba(255, 253, 247, 0.98)",
  border: "1px solid #d1b66a",
  borderRadius: 12,
  boxShadow: "0 6px 16px rgba(80, 60, 20, 0.08)",
  color: "#111827",
};

const OFFICIAL_HEADER_STYLES_INPUT: Parameters<
  typeof getResultsTableHeaderStyles
>[0] = {
  tableText: "#111827",
  tableFontSize: "12px",
  goldLine: "#a98322",
  goldLineSoft: "rgba(151, 116, 28, 0.34)",
};

const OFFICIAL_GOLDEN_TABLE_CSS = `
  .results12GoldenTableScope {
    background: linear-gradient(180deg, #f7f1e4 0%, #eee2c9 100%) !important;
    color: #111827 !important;
  }

  .results12GoldenTableScope table,
  .results12GoldenTableScope td,
  .results12GoldenTableScope th,
  .results12GoldenTableScope button,
  .results12GoldenTableScope input,
  .results12GoldenTableScope select,
  .results12GoldenTableScope textarea {
    box-sizing: border-box !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    text-shadow: none !important;
  }

  .results12GoldenTableScope input,
  .results12GoldenTableScope select,
  .results12GoldenTableScope textarea,
  .results12GoldenTableScope option {
    background: #fffdf7 !important;
    border: 1px solid #c8ad61 !important;
    border-radius: 8px !important;
    font-weight: 650 !important;
    outline: none !important;
  }

  .results12GoldenTableScope input:focus,
  .results12GoldenTableScope select:focus,
  .results12GoldenTableScope textarea:focus {
    border-color: #947329 !important;
    box-shadow: 0 0 0 2px rgba(148,115,41,0.18) !important;
  }

  .results12GoldenTableScope button {
    font-weight: 700 !important;
    border-color: rgba(148,115,41,0.36) !important;
  }

  .results12GoldenTableScope table {
    width: 100% !important;
    background: #fffdf7 !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border: 1px solid #c8ad61 !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: 0 6px 18px rgba(80,60,20,0.08) !important;
  }

  .results12GoldenTableScope table thead th,
  .results12GoldenTableScope table tfoot td,
  .results12GoldenTableScope table tfoot th {
    background: linear-gradient(180deg, #f8ebc8 0%, #e3c978 100%) !important;
    border: 1px solid #b89538 !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: 11.5px !important;
    font-weight: 800 !important;
    line-height: 1.3 !important;
    padding: 5px 6px !important;
    vertical-align: middle !important;
    white-space: normal !important;
  }

  .results12GoldenTableScope table tbody td {
    background: #fffdf7 !important;
    border: 1px solid rgba(184,149,56,0.34) !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    padding: 4px 5px !important;
    vertical-align: top !important;
    box-shadow: none !important;
  }

  .results12GoldenTableScope table tbody tr:nth-child(even) td:not(.results12TaskInvigilation):not(.results12TaskReserve):not(.results12TaskDuty):not(.results12CellEmptyOfficial) {
    background: #fbf5e6 !important;
  }

  .results12GoldenTableScope table tbody tr:hover td:not(.results12TaskInvigilation):not(.results12TaskReserve):not(.results12TaskDuty):not(.results12CellEmptyOfficial) {
    background: #f4e9c9 !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation {
    background: linear-gradient(180deg, #edf5ff 0%, #d8e9ff 100%) !important;
    border: 1.25px solid #3b78bd !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 6px rgba(59,120,189,0.14) !important;
    animation: results12CommercialBluePulse 4.2s ease-in-out infinite !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskReserve {
    background: linear-gradient(180deg, #edf9f0 0%, #d9f0df 100%) !important;
    border: 1.25px solid #3d8b5b !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 6px rgba(61,139,91,0.14) !important;
    animation: results12CommercialGreenPulse 4.2s ease-in-out infinite !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskDuty {
    background: linear-gradient(180deg, #fff0f0 0%, #f9dddd 100%) !important;
    border: 1.25px solid #bf4d4d !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 6px rgba(191,77,77,0.14) !important;
    animation: results12CommercialRedPulse 4.2s ease-in-out infinite !important;
  }

  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial,
  .results12GoldenTableScope table tbody td:empty {
    background: linear-gradient(180deg, #fff9e5 0%, #f2e1a7 100%) !important;
    border: 1.25px solid #b89538 !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45) !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation > *,
  .results12GoldenTableScope table tbody td.results12TaskReserve > *,
  .results12GoldenTableScope table tbody td.results12TaskDuty > *,
  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial > * {
    background: transparent !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: inherit !important;
    line-height: 1.3 !important;
    max-width: 100% !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation button,
  .results12GoldenTableScope table tbody td.results12TaskReserve button,
  .results12GoldenTableScope table tbody td.results12TaskDuty button,
  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial button {
    background: rgba(255,255,255,0.46) !important;
    border: 1px solid rgba(17,24,39,0.16) !important;
    border-radius: 8px !important;
    padding: 3px 7px !important;
    margin: 1px 2px !important;
    min-height: auto !important;
    font-size: 11.5px !important;
    font-weight: 750 !important;
    box-shadow: none !important;
  }

  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial button {
    background: #fff8df !important;
    border-color: rgba(184,149,56,0.50) !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation button:hover,
  .results12GoldenTableScope table tbody td.results12TaskReserve button:hover,
  .results12GoldenTableScope table tbody td.results12TaskDuty button:hover,
  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial button:hover {
    background: rgba(255,255,255,0.72) !important;
    transform: translateY(-1px) !important;
  }

  @keyframes results12CommercialBluePulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 4px rgba(59,120,189,0.10); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.50), 0 0 8px rgba(59,120,189,0.20); }
  }

  @keyframes results12CommercialGreenPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 4px rgba(61,139,91,0.10); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.50), 0 0 8px rgba(61,139,91,0.20); }
  }

  @keyframes results12CommercialRedPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 4px rgba(191,77,77,0.10); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.50), 0 0 8px rgba(191,77,77,0.20); }
  }

  @media (prefers-reduced-motion: reduce) {
    .results12GoldenTableScope * {
      animation: none !important;
      transition: none !important;
    }
  }

  @media print {
    .results12GoldenTableScope,
    .results12GoldenTableScope * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      text-shadow: none !important;
      animation: none !important;
      box-shadow: none !important;
      transition: none !important;
    }

    .results12GoldenTableScope {
      background: #ffffff !important;
      padding: 0 !important;
    }

    .results12GoldenTableScope table {
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    .results12GoldenTableScope table thead th,
    .results12GoldenTableScope table tbody td,
    .results12GoldenTableScope table tfoot td,
    .results12GoldenTableScope table tfoot th {
      padding: 3px 4px !important;
      font-size: 10.5px !important;
    }
  }
`;

function normalizeSubject(subject: string) {
  return String(subject || "")
    .replace(/\s+/g, " ")
    .trim();
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
      auth?.effectiveTenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        auth?.user?.tenantId ||
        "default",
    ).trim() || "default"
  );
}

const OFFICIAL_TASK_CLASS_NAMES = [
  "results12TaskInvigilation",
  "results12TaskReserve",
  "results12TaskDuty",
  "results12CellEmptyOfficial",
];

function cleanArabicText(value: string) {
  return String(value || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAddActionText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanArabicText(raw).toLowerCase();

  return (
    !text ||
    text === "+" ||
    /^\+/.test(raw) ||
    /^(اضافة|إضافة|add)(\s|$)/i.test(raw) ||
    /\+\s*(احتياط|مراقبة|مراقب|فاضي|review|correction|reserve|invigilation|duty)/i.test(raw) ||
    /(فاضي\s*للمراجعة|فاضي\s*للتصحيح|free\s*for\s*review|free\s*for\s*correction)/i.test(text)
  );
}

function getOfficialTaskClassFromText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanArabicText(raw).toLowerCase();

  if (!text) return "results12CellEmptyOfficial";
  if (isAddActionText(raw)) return "";

  if (/مراقب\s*دور|duty\s*invigilator/.test(text)) return "results12TaskDuty";
  if (/(^|\s)(احتياط|reserve)(\s|$)/.test(text)) return "results12TaskReserve";
  if (/مراقبة|invigilation/.test(text)) return "results12TaskInvigilation";

  return "";
}

function isOfficialEmptyCellText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanArabicText(raw);

  return (
    !text ||
    text === "—" ||
    text === "-" ||
    text === "+" ||
    text === "إضافة" ||
    text === "اضافة" ||
    text.toLowerCase() === "add" ||
    isAddActionText(raw)
  );
}


function getCellTextWithoutActionButtons(cell: HTMLElement) {
  const clone = cell.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("button, [role='button']")
    .forEach((node) => node.parentElement?.removeChild(node));
  return String(clone.textContent || "").replace(/\s+/g, " ").trim();
}

function applyOfficialTaskClasses(root: HTMLElement | null) {
  if (!root) return;

  OFFICIAL_TASK_CLASS_NAMES.forEach((className) => {
    root
      .querySelectorAll(`.${className}`)
      .forEach((node) => node.classList.remove(className));
  });

  const cells = Array.from(
    root.querySelectorAll<HTMLElement>(
      "tbody td, [role='cell'], [role='gridcell']",
    ),
  );

  cells.forEach((cell) => {
    const fullCellText = String(cell.textContent || "");
    const textWithoutButtons = getCellTextWithoutActionButtons(cell);
    const buttons = Array.from(
      cell.querySelectorAll<HTMLElement>("button, [role='button']"),
    );
    const hasAddActionButton = buttons.some((button) =>
      isAddActionText(button.textContent || ""),
    );
    const hasOnlyAddActions =
      buttons.length > 0 &&
      buttons.every((button) => isAddActionText(button.textContent || ""));

    if (
      hasOnlyAddActions ||
      (hasAddActionButton && isOfficialEmptyCellText(textWithoutButtons)) ||
      isOfficialEmptyCellText(fullCellText)
    ) {
      cell.classList.add("results12CellEmptyOfficial");
      return;
    }

    const cellClass = getOfficialTaskClassFromText(
      textWithoutButtons || fullCellText,
    );
    if (cellClass) {
      cell.classList.add(cellClass);
    }
  });
}

function normalizeResultsTaskType(taskType: any) {
  const raw = String(taskType || "")
    .trim()
    .toUpperCase();

  if (
    raw === "INVIGILATION" ||
    raw === "RESERVE" ||
    raw === "DUTY_INVIGILATOR" ||
    raw === "REVIEW_FREE" ||
    raw === "CORRECTION_FREE"
  ) {
    return raw;
  }

  return raw || "DUTY_INVIGILATOR";
}

function normalizeRunForDutyInvigilator(run: any) {
  if (!run || !Array.isArray(run.assignments)) return run;

  return {
    ...run,
    assignments: run.assignments.map((assignment: any) => {
      const taskType = normalizeResultsTaskType(assignment?.taskType);
      if (taskType !== "DUTY_INVIGILATOR") return { ...assignment, taskType };

      const subject = "مراقب دور";

      return {
        ...assignment,
        taskType: "DUTY_INVIGILATOR",
        taskTypeLabelAr: "مراقب دور",
        subject,
        dutyInvigilator: true,
        fullDay: assignment?.fullDay ?? true,
        coversPeriods: assignment?.coversPeriods || ["AM", "PM"],
        reviewBySubject1Only: undefined,
        correctionFixedNextDayOnly: undefined,
        basedOnExamTableOnly: undefined,
      };
    }),
  };
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const auth = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback(
    (ar: string, en: string) => (lang === "ar" ? ar : en),
    [lang],
  );
  const tenantId = React.useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const printAreaRef = React.useRef<HTMLDivElement>(null);
  const [showTeacherSidebar, setShowTeacherSidebar] = React.useState(true);

  const formatPeriod = React.useCallback(
    (period?: string) => {
      const p = String(period || "AM").toUpperCase();
      return p === "PM" || p === "BM"
        ? tr("الفترة الثانية", "Second Period")
        : tr("الفترة الأولى", "First Period");
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
        case "DUTY_INVIGILATOR":
          return tr("مراقب دور", "Duty Invigilator");
        case "REVIEW_FREE":
          return tr("فاضي للمراجعة", "Free for review");
        case "CORRECTION_FREE":
          return tr("فاضي للتصحيح", "Free for correction");
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
      if (Number.isNaN(d.getTime()))
        return { day: value, full: value, line: value };

      const locale = lang === "ar" ? "ar" : "en";
      const day = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
        d,
      );
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
  const runForResults = React.useMemo(
    () => normalizeRunForDutyInvigilator(run),
    [run],
  );
  const interaction = useResultsInteractionState(tenantId);
  const dataModel = useResultsDataModel({
    tenantId,
    run: runForResults,
    normalizeSubject,
  });

  const pageActions = useResultsPageActions({
    tenantId,
    run: runForResults,
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
    run: runForResults,
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

  const addTaskToEmptyCellSynced = React.useCallback(
    (dstTeacher: string, dstColKey: string, taskType: string) => {
      const safeTaskType =
        normalizeResultsTaskType(taskType) || "DUTY_INVIGILATOR";
      tableActions.addTaskToEmptyCell(dstTeacher, dstColKey, safeTaskType);
    },
    [tableActions],
  );

  const isDraggableTaskTypeSynced = React.useCallback(
    (taskType: any) =>
      String(taskType || "")
        .trim()
        .toUpperCase() === "DUTY_INVIGILATOR" ||
      tableActions.isDraggableTaskType(taskType),
    [tableActions],
  );

  const getAssignmentsInCell = React.useCallback(
    (teacher: string, subColKey: string) =>
      tableActions.getAssignmentsInCell(
        runForResults?.assignments || [],
        teacher,
        subColKey,
        normalizeSubject,
      ),
    [runForResults, tableActions],
  );

  useResultsClipboardShortcuts({
    selectedCell: interaction.selectedCell,
    clipboardUid: interaction.clipboardUid,
    setClipboardUid: interaction.setClipboardUid,
    run: runForResults,
    getAssignmentsInCell,
    swapAssignmentsByUid: tableActions.swapAssignmentsByUid,
    moveAssignmentToColumnTeacher: tableActions.moveAssignmentToColumnTeacher,
    isDraggableTaskType: isDraggableTaskTypeSynced,
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

  const teacherRowColor = React.useCallback(
    (index: number) => ({
      stripe: ["#38bdf8", "#c084fc", "#22c55e", "#f59e0b", "#ef4444"][
        index % 5
      ],
    }),
    [],
  );

  const styles = React.useMemo(
    () => ({
      ...OFFICIAL_HEADER_STYLES_INPUT,
      ...getResultsTableHeaderStyles(OFFICIAL_HEADER_STYLES_INPUT),
    }),
    [],
  );

  const hasRun = Boolean(
    runForResults &&
    Array.isArray(runForResults.assignments) &&
    runForResults.assignments.length,
  );

  React.useEffect(() => {
    if (!hasRun) return;

    const apply = () => applyOfficialTaskClasses(printAreaRef.current);
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
  }, [
    hasRun,
    runForResults,
    dataModel.allSubCols.length,
    dataModel.allTeachers.length,
    showTeacherSidebar,
    interaction.tableFullScreen,
  ]);

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
        <div style={OFFICIAL_PANEL_STYLE}>
          <ResultsPageHeader
            runId={String(runForResults?.runId || "—")}
            createdAtISO={runForResults?.createdAtISO}
            importError={interaction.importError || undefined}
            tableFullScreen={interaction.tableFullScreen}
            undoDisabled={!interaction.undoStack.length}
            onGoHome={() => nav("/task-distribution/run")}
            onPickImportFile={pageActions.handlePickImportFile}
            onExportPdf={pageActions.handleExportPdf}
            onArchiveSnapshot={pageActions.handleArchiveSnapshot}
            onToggleFullscreen={() =>
              interaction.setTableFullScreen(!interaction.tableFullScreen)
            }
            onUndo={() => pageActions.handleUndo(interaction.undoStack)}
            onExportExcel={tableActions.exportExcel}
            onPrintTableOnly={pageActions.handlePrintTableOnly}
            showTeacherSidebar={showTeacherSidebar}
            onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
          />
        </div>
      ) : null}

      <div ref={printAreaRef}>
        <ResultsTable
          displayDates={dataModel.displayDates}
          dateToSubCols={dataModel.dateToSubCols}
          allSubCols={dataModel.allSubCols}
          allTeachers={dataModel.allTeachers}
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
          isDraggableTaskType={isDraggableTaskTypeSynced}
          dragSrcUid={interaction.dragSrcUid}
          dragOverUid={interaction.dragOverUid}
          setDragSrcUid={interaction.setDragSrcUid}
          setDragOverUid={interaction.setDragOverUid}
          onSwap={tableActions.swapAssignmentsByUid}
          onDropToEmpty={tableActions.handleDropToEmptyCell}
          onDropToCell={tableActions.handleDropToCell}
          onAddToEmpty={addTaskToEmptyCellSynced}
          onDeleteByUid={tableActions.deleteAssignmentByUid}
          onDeleteSubCol={tableActions.deleteAssignmentsBySubCol}
          styles={styles as any}
          formatDateWithDayAr={formatDateWithDay}
          containerMaxHeight={
            interaction.tableFullScreen ? "calc(100vh - 120px)" : "72vh"
          }
          selectedCell={interaction.selectedCell}
          onSelectCell={interaction.setSelectedCell}
          isConflictUid={(uid) => dataModel.conflictUids.has(uid)}
          getUnavailabilityReasonForCell={
            tableActions.getUnavailabilityReasonForCell
          }
          blockedCellMsg={interaction.blockedCellMsg}
          showTeacherSidebar={showTeacherSidebar}
        />

        <div style={{ marginTop: 16 }}>
          <ResultsFooterPanels
            warnings={dataModel.warnings}
            assignmentsCount={dataModel.assignments.length}
            daysCount={dataModel.displayDates.length}
            columnsCount={dataModel.allSubCols.length}
            teachersCount={dataModel.allTeachers.length}
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
      <div
        className="results12GoldenTableScope"
        style={{ ...OFFICIAL_PAGE_STYLE, padding: 8 }}
      >
        <style>{OFFICIAL_GOLDEN_TABLE_CSS}</style>
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#f8f2e6",
            padding: 8,
            overflow: "auto",
          }}
        >
          <div
            style={{
              ...container,
              width: "100%",
              maxWidth: "100%",
              padding: 0,
            }}
          >
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
    <div className="results12GoldenTableScope" style={OFFICIAL_PAGE_STYLE}>
      <style>{OFFICIAL_GOLDEN_TABLE_CSS}</style>
      <div
        style={{ ...container, width: "min(1880px, 100%)", maxWidth: "100%" }}
      >
        {sharedImportControls}
        {content}
      </div>
    </div>
  );
}
