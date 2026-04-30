import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import type { SubCol } from "./TeacherRow";
import { ResultsTableHeader } from "./ResultsTableHeader";
import { ResultsTotalsRow } from "./ResultsTotalsRow";
import { buildInvigilationDeficitBySubCol, buildRequiredBySubCol, buildReserveCountBySubCol } from "../services/resultsTableDerivedMaps";
import { getResultsTableContainerStyle, RESULTS_TABLE_CONFLICT_CSS } from "../services/resultsTablePresentation";

export type ResultsTableProps = {
  displayDates: string[];
  dateToSubCols: Map<string, SubCol[]>;
  allSubCols: SubCol[];
  allTeachers: string[];
  matrix2: Record<string, Record<string, Assignment[]>>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<
    string,
    { inv: number; res: number; corr: number; total: number; deficit: number; committees: number; required?: number }
  >;
  teacherTotals: Record<string, number>;

  columnColor: (index: number) => { colBg: string; headBg: string };
  teacherRowColor: (index: number) => { stripe: string };
  getSubjectBackground: (subject?: string) => string;
  taskLabel: (t: any) => string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
  getCommitteeNo: (a: any) => string | undefined;

  isDraggableTaskType: (taskType: any) => boolean;
  dragSrcUid: string | null;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onSwap: (srcUid: string, dstUid: string) => void;
  onDropToEmpty: (srcUid: string, dstTeacher: string, subColKey: string) => void;
  onDropToCell?: (srcUid: string, dstTeacher: string, subColKey: string, dstCellList: any[]) => void;
  onAddToEmpty?: (dstTeacher: string, subColKey: string, taskType: string) => void;
  onDeleteByUid?: (uid: string) => void;
  onDeleteSubCol?: (subColKey: string) => void;

  styles: {
    tableText: string;
    tableFontSize: string;
    goldLine: string;
    goldLineSoft: string;
    teacherHeaderStyle: React.CSSProperties;
    teacherTotalHeaderStyle: React.CSSProperties;
  };

  formatDateWithDayAr: (dateISO: string) => { day: string; full: string; line: string };
  containerMaxHeight?: string;
  selectedCell?: { teacher: string; subColKey: string; uid?: string } | null;
  onSelectCell?: (payload: { teacher: string; subColKey: string; uid?: string }) => void;
  isConflictUid?: (uid: string) => boolean;
  getUnavailabilityReasonForCell?: (teacherName: string, subColKey: string, taskType: string) => string | null;
  blockedCellMsg?: Record<string, string>;
  showTeacherSidebar?: boolean;
};

type HighlightKind = "review" | "correction" | "reserve" | null;

function normalizeTaskType(taskType: any) {
  const raw = String(taskType || "").trim().toUpperCase();
  if (raw === "REVIEW_FREE" || raw.includes("مراجعة")) return "REVIEW_FREE";
  if (raw === "CORRECTION_FREE" || raw.includes("تصحيح")) return "CORRECTION_FREE";
  if (raw === "RESERVE" || raw.includes("احتياط")) return "RESERVE";
  return raw;
}

function getHighlightKind(taskType: any): HighlightKind {
  const safeTaskType = normalizeTaskType(taskType);
  if (safeTaskType === "REVIEW_FREE") return "review";
  if (safeTaskType === "CORRECTION_FREE") return "correction";
  if (safeTaskType === "RESERVE") return "reserve";
  return null;
}

function getCellHighlightKind(assignments: Assignment[]): HighlightKind {
  const hasCorrection = assignments.some((a: any) => getHighlightKind(a?.taskType) === "correction");
  if (hasCorrection) return "correction";
  const hasReview = assignments.some((a: any) => getHighlightKind(a?.taskType) === "review");
  if (hasReview) return "review";
  const hasReserve = assignments.some((a: any) => getHighlightKind(a?.taskType) === "reserve");
  if (hasReserve) return "reserve";
  return null;
}

function getBlinkClass(kind: HighlightKind) {
  if (kind === "review") return "results-cell-blink-review";
  if (kind === "correction") return "results-cell-blink-correction";
  if (kind === "reserve") return "results-cell-blink-reserve";
  return "";
}

function getTaskDisplayLabel(taskType: any, lang: string, fallbackLabel: (t: any) => string) {
  const safeTaskType = normalizeTaskType(taskType);
  if (safeTaskType === "REVIEW_FREE") return lang === "ar" ? "فاضي للمراجعة" : "Free for review";
  if (safeTaskType === "CORRECTION_FREE") return lang === "ar" ? "فاضي للتصحيح" : "Free for correction";
  if (safeTaskType === "RESERVE") return lang === "ar" ? "احتياط" : "Reserve";
  return fallbackLabel(taskType);
}

function getTaskCardStyle(kind: HighlightKind, isDragging: boolean, isConflict: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "fit-content",
    minWidth: 118,
    maxWidth: "calc(100% - 14px)",
    margin: "0 auto",
    borderRadius: 12,
    padding: "6px 10px",
    textAlign: "center",
    fontWeight: 950,
    lineHeight: 1.25,
    cursor: "grab",
    userSelect: "none",
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 10px 24px rgba(15,23,42,.18)",
    opacity: isDragging ? 0.45 : 1,
    outline: isConflict ? "3px solid #f97316" : undefined,
  };

  if (kind === "review") {
    return {
      ...base,
      color: "#ffffff",
      background: "linear-gradient(135deg, rgba(37,99,235,.98), rgba(14,165,233,.94))",
      border: "2px solid rgba(147,197,253,.98)",
      textShadow: "0 1px 3px rgba(0,0,0,.35)",
    };
  }

  if (kind === "correction") {
    return {
      ...base,
      color: "#ffffff",
      background: "linear-gradient(135deg, rgba(220,38,38,.98), rgba(239,68,68,.94))",
      border: "2px solid rgba(254,202,202,.98)",
      textShadow: "0 1px 3px rgba(0,0,0,.35)",
    };
  }

  if (kind === "reserve") {
    return {
      ...base,
      color: "#ffffff",
      background: "linear-gradient(135deg, rgba(22,163,74,.98), rgba(34,197,94,.94))",
      border: "2px solid rgba(187,247,208,.98)",
      textShadow: "0 1px 3px rgba(0,0,0,.35)",
    };
  }

  return {
    ...base,
    color: "#111827",
    background: "rgba(255,255,255,.92)",
    border: "1px solid rgba(212,175,55,.55)",
  };
}

function getTdStyle(args: {
  colBg: string;
  goldLineSoft: string;
  isSelected: boolean;
  isDropTarget: boolean;
  cellKind: HighlightKind;
}): React.CSSProperties {
  const { colBg, goldLineSoft, isSelected, isDropTarget, cellKind } = args;
  const base: React.CSSProperties = {
    minHeight: 58,
    height: 58,
    padding: 6,
    verticalAlign: "top",
    borderRadius: 16,
    border: `1px solid ${goldLineSoft}`,
    background: colBg,
    boxShadow: isSelected ? "0 0 0 3px rgba(250,204,21,.55) inset" : undefined,
    outline: isDropTarget ? "3px solid rgba(255,255,255,.85)" : undefined,
    transition: "box-shadow .15s ease, outline .15s ease, transform .15s ease",
  };

  if (cellKind === "review") {
    return {
      ...base,
      background: "linear-gradient(135deg, rgba(250,204,21,.96), rgba(212,175,55,.88))",
      border: "2px solid rgba(59,130,246,.95)",
      boxShadow: `${isSelected ? "0 0 0 3px rgba(250,204,21,.55) inset, " : ""}0 0 18px rgba(59,130,246,.48)`,
    };
  }

  if (cellKind === "correction") {
    return {
      ...base,
      background: "linear-gradient(135deg, rgba(250,204,21,.96), rgba(212,175,55,.88))",
      border: "2px solid rgba(239,68,68,.95)",
      boxShadow: `${isSelected ? "0 0 0 3px rgba(250,204,21,.55) inset, " : ""}0 0 18px rgba(239,68,68,.46)`,
    };
  }

  if (cellKind === "reserve") {
    return {
      ...base,
      background: "linear-gradient(135deg, rgba(250,204,21,.96), rgba(212,175,55,.88))",
      border: "2px solid rgba(34,197,94,.95)",
      boxShadow: `${isSelected ? "0 0 0 3px rgba(250,204,21,.55) inset, " : ""}0 0 18px rgba(34,197,94,.42)`,
    };
  }

  return base;
}

export function ResultsTable(props: ResultsTableProps) {
  const { lang } = useI18n();
  const {
    displayDates,
    dateToSubCols,
    allSubCols,
    allTeachers,
    committeesCountBySubCol,
    totalsDetailBySubCol,
    teacherTotals,
    styles,
    columnColor,
    teacherRowColor,
    formatDateWithDayAr,
    formatPeriod,
    showTeacherSidebar = true,
  } = props;

  const containerStyle = getResultsTableContainerStyle({
    containerMaxHeight: props.containerMaxHeight,
    goldLine: styles.goldLine,
  });
  const invigilationDeficitBySubCol = buildInvigilationDeficitBySubCol(totalsDetailBySubCol);
  const reserveCountBySubCol = buildReserveCountBySubCol(totalsDetailBySubCol);
  const requiredBySubCol = buildRequiredBySubCol(totalsDetailBySubCol);

  const handleDrop = React.useCallback(
    (teacher: string, subColKey: string, cellAssignments: Assignment[]) => {
      const srcUid = props.dragSrcUid;
      if (!srcUid) return;
      const target = cellAssignments.find((a: any) => String(a?.__uid || "") && String(a?.__uid) !== srcUid);
      if (target && props.onDropToCell) {
        props.onDropToCell(srcUid, teacher, subColKey, cellAssignments as any[]);
        return;
      }
      if (target && (target as any).__uid) {
        props.onSwap(srcUid, String((target as any).__uid));
        return;
      }
      props.onDropToEmpty(srcUid, teacher, subColKey);
    },
    [props],
  );

  return (
    <div style={containerStyle}>
      <style>{`${RESULTS_TABLE_CONFLICT_CSS}
        @keyframes resultsReviewBlink {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.38); transform: scale(1.015); }
        }
        @keyframes resultsCorrectionBlink {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.42); transform: scale(1.015); }
        }
        @keyframes resultsReserveBlink {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.35); transform: scale(1.015); }
        }
        .results-cell-blink-review { animation: resultsReviewBlink 1.05s ease-in-out infinite; }
        .results-cell-blink-correction { animation: resultsCorrectionBlink 1.05s ease-in-out infinite; }
        .results-cell-blink-reserve { animation: resultsReserveBlink 1.05s ease-in-out infinite; }
        @media print {
          .results-cell-blink-review,
          .results-cell-blink-correction,
          .results-cell-blink-reserve { animation: none !important; filter: none !important; transform: none !important; }
        }
      `}</style>
      <table
        style={{
          width: "100%",
          minWidth: "max-content",
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: "6px 8px",
          direction: lang === "ar" ? "rtl" : "ltr",
          fontSize: styles.tableFontSize,
          fontWeight: 800,
          color: styles.tableText,
        }}
      >
        <colgroup>
          {showTeacherSidebar ? <col style={{ width: 260 }} /> : null}
          {allSubCols.map((sc) => {
            const isCorrection = String(sc.subject || "").includes("تصحيح") || String(sc.key || "").includes("تصحيح");
            return <col key={sc.key} style={{ width: isCorrection ? 290 : 240 }} />;
          })}
          <col style={{ width: 160 }} />
        </colgroup>

        <ResultsTableHeader
          displayDates={displayDates}
          dateToSubCols={dateToSubCols}
          allSubCols={allSubCols}
          committeesCountBySubCol={committeesCountBySubCol}
          styles={styles}
          formatDateWithDayAr={formatDateWithDayAr}
          formatPeriod={formatPeriod}
          onDeleteSubCol={props.onDeleteSubCol}
          showTeacherSidebar={showTeacherSidebar}
        />

        <tbody>
          {allTeachers.map((teacher, tIdx) => {
            const rowAccent = teacherRowColor(tIdx).stripe;
            return (
              <tr key={teacher}>
                {showTeacherSidebar ? (
                  <th
                    scope="row"
                    style={{
                      position: "sticky",
                      right: lang === "ar" ? 0 : undefined,
                      left: lang === "ar" ? undefined : 0,
                      zIndex: 4,
                      borderRadius: 16,
                      padding: "10px 12px",
                      textAlign: lang === "ar" ? "right" : "left",
                      color: "#111827",
                      background: "linear-gradient(135deg, rgba(255,248,220,.98), rgba(250,204,21,.32))",
                      border: `1px solid ${styles.goldLineSoft}`,
                      borderInlineStart: `6px solid ${rowAccent}`,
                      boxShadow: "0 8px 18px rgba(15,23,42,.14)",
                      fontWeight: 950,
                      textShadow: "none",
                    }}
                  >
                    {teacher}
                  </th>
                ) : null}

                {allSubCols.map((sc, cIdx) => {
                  const assignments = props.matrix2?.[teacher]?.[sc.key] || [];
                  const cellKind = getCellHighlightKind(assignments);
                  const selected = props.selectedCell?.teacher === teacher && props.selectedCell?.subColKey === sc.key && !props.selectedCell?.uid;
                  const isDropTarget = assignments.some((a: any) => String(a?.__uid || "") === props.dragOverUid);
                  const colTone = columnColor(cIdx);
                  const blockedMsg = props.blockedCellMsg?.[`${teacher}__${sc.key}`];

                  return (
                    <td
                      key={sc.key}
                      className={getBlinkClass(cellKind)}
                      style={getTdStyle({
                        colBg: colTone.colBg,
                        goldLineSoft: styles.goldLineSoft,
                        isSelected: Boolean(selected),
                        isDropTarget,
                        cellKind,
                      })}
                      onClick={() => props.onSelectCell?.({ teacher, subColKey: sc.key })}
                      onDragOver={(event) => {
                        if (props.dragSrcUid) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop(teacher, sc.key, assignments);
                        props.setDragOverUid(null);
                      }}
                    >
                      <div style={{ display: "grid", gap: 5, alignItems: "start" }}>
                        {assignments.map((assignment: any) => {
                          const uid = String(assignment?.__uid || "");
                          const kind = getHighlightKind(assignment?.taskType);
                          const draggable = props.isDraggableTaskType(assignment?.taskType);
                          const label = getTaskDisplayLabel(assignment?.taskType, lang, props.taskLabel);
                          const committeeNo = props.getCommitteeNo(assignment);
                          const subject = props.normalizeSubject(String(assignment?.subject || sc.subject || ""));
                          const isDragging = uid !== "" && props.dragSrcUid === uid;
                          const isConflict = uid !== "" && Boolean(props.isConflictUid?.(uid));

                          return (
                            <div
                              key={uid || `${teacher}-${sc.key}-${label}-${committeeNo || ""}`}
                              className={getBlinkClass(kind)}
                              style={getTaskCardStyle(kind, isDragging, isConflict)}
                              draggable={Boolean(uid && draggable)}
                              onClick={(event) => {
                                event.stopPropagation();
                                props.onSelectCell?.({ teacher, subColKey: sc.key, uid });
                              }}
                              onDragStart={(event) => {
                                if (!uid || !draggable) return;
                                props.setDragSrcUid(uid);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", uid);
                              }}
                              onDragEnter={() => {
                                if (uid) props.setDragOverUid(uid);
                              }}
                              onDragEnd={() => {
                                props.setDragSrcUid(null);
                                props.setDragOverUid(null);
                              }}
                            >
                              <div>{label}</div>
                              {committeeNo ? <div style={{ fontSize: 10, opacity: 0.92 }}>لجنة {committeeNo}</div> : null}
                              {subject && kind === null ? <div style={{ fontSize: 10, opacity: 0.78 }}>{subject}</div> : null}
                              {props.onDeleteByUid && uid ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    props.onDeleteByUid?.(uid);
                                  }}
                                  style={{
                                    marginTop: 4,
                                    border: "0",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                    cursor: "pointer",
                                    fontSize: 10,
                                    fontWeight: 900,
                                    background: "rgba(255,255,255,.82)",
                                    color: "#111827",
                                  }}
                                  aria-label={lang === "ar" ? "حذف المهمة" : "Delete task"}
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          );
                        })}

                        {!assignments.length && props.onAddToEmpty ? (
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                props.onAddToEmpty?.(teacher, sc.key, "RESERVE");
                              }}
                              style={{
                                border: "1px solid rgba(34,197,94,.65)",
                                background: "rgba(34,197,94,.16)",
                                color: "#166534",
                                borderRadius: 999,
                                padding: "3px 8px",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              + احتياط
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                props.onAddToEmpty?.(teacher, sc.key, "REVIEW_FREE");
                              }}
                              style={{
                                border: "1px solid rgba(59,130,246,.65)",
                                background: "rgba(59,130,246,.16)",
                                color: "#1d4ed8",
                                borderRadius: 999,
                                padding: "3px 8px",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              + مراجعة
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                props.onAddToEmpty?.(teacher, sc.key, "CORRECTION_FREE");
                              }}
                              style={{
                                border: "1px solid rgba(239,68,68,.65)",
                                background: "rgba(239,68,68,.14)",
                                color: "#dc2626",
                                borderRadius: 999,
                                padding: "3px 8px",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              + تصحيح
                            </button>
                          </div>
                        ) : null}

                        {blockedMsg ? (
                          <div style={{ color: "#b91c1c", fontSize: 10, fontWeight: 900, textAlign: "center" }}>{blockedMsg}</div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}

                <td
                  style={{
                    borderRadius: 16,
                    padding: "10px 12px",
                    textAlign: "center",
                    fontWeight: 950,
                    color: styles.tableText,
                    background: "rgba(255,255,255,.94)",
                    border: `1px solid ${styles.goldLineSoft}`,
                    boxShadow: "0 8px 18px rgba(15,23,42,.14)",
                  }}
                >
                  {teacherTotals[teacher] ?? 0}
                </td>
              </tr>
            );
          })}

          <ResultsTotalsRow
            allSubCols={allSubCols}
            totalsDetailBySubCol={totalsDetailBySubCol}
            committeesCountBySubCol={committeesCountBySubCol}
            styles={{
              tableFontSize: styles.tableFontSize,
              goldLine: styles.goldLine,
              goldLineSoft: styles.goldLineSoft,
            }}
            showTeacherSidebar={showTeacherSidebar}
          />
        </tbody>
      </table>
    </div>
  );
}
