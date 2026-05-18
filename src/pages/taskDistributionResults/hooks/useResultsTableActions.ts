import { exportExcelStyledLikeTable } from "../excelExport";
import { useAuth } from "../../../auth/AuthContext";
import { useResultsDragDropActions } from "./useResultsDragDropActions";
import { addTaskToResultsEmptyCell, deleteAssignmentFromResultsRun, deleteAssignmentsForSubColFromResultsRun } from "../services/resultsCellMutations";
import { getAssignmentsInCell, isDraggableTaskType } from "../services/resultsDragDropRules";
import { createResultsCellUnavailabilityResolver } from "../services/resultsTableActionResolvers";
import { buildResultsExcelExportPayload } from "../services/resultsTableActionPayloads";


const MUTATION_BLOCK_MSG_AR = "وضع المشاهدة فقط: لا يمكن تعديل جدول النتائج.";
const MISSING_TENANT_MSG_AR = "لا يمكن حفظ التعديل: لم يتم تحديد المؤسسة/المدرسة.";

function isTruthyFlag(value: any) {
  if (value === true) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "readonly" || text === "read-only";
}

function getAuthRole(auth: any) {
  return String(
    auth?.effectiveRole ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      auth?.user?.role ||
      auth?.role ||
      "",
  )
    .trim()
    .toLowerCase();
}

function isReadOnlyResultsSession(auth: any) {
  const explicitFlags = [
    auth?.readOnly,
    auth?.isReadOnly,
    auth?.readonly,
    auth?.viewOnly,
    auth?.isViewOnly,
    auth?.effectiveReadOnly,
    auth?.profile?.readOnly,
    auth?.profile?.readonly,
    auth?.profile?.viewOnly,
    auth?.userProfile?.readOnly,
    auth?.userProfile?.readonly,
    auth?.permissions?.readOnly,
    auth?.effectivePermissions?.readOnly,
  ];

  if (explicitFlags.some(isTruthyFlag)) return true;

  const role = getAuthRole(auth);
  if (["viewer", "read_only", "readonly", "view_only", "observer"].includes(role)) return true;

  try {
    if (typeof sessionStorage !== "undefined") {
      const sessionFlags = [
        sessionStorage.getItem("exam-manager:readOnly"),
        sessionStorage.getItem("exam-manager:view-only"),
        sessionStorage.getItem("exam-manager:super-admin:view-only"),
        sessionStorage.getItem("exam-manager:tenant-readonly"),
      ];
      if (sessionFlags.some(isTruthyFlag)) return true;
    }
    if (typeof localStorage !== "undefined") {
      const localFlags = [
        localStorage.getItem("exam-manager:readOnly"),
        localStorage.getItem("exam-manager:view-only"),
        localStorage.getItem("exam-manager:super-admin:view-only"),
        localStorage.getItem("exam-manager:tenant-readonly"),
      ];
      if (localFlags.some(isTruthyFlag)) return true;
    }
  } catch {}

  return false;
}

function safeAlert(message: string) {
  try {
    if (typeof window !== "undefined") window.alert(message);
  } catch {}
}

function normalizeManualTaskType(value: any) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "INVIGILATION" || raw.includes("مراقبة")) return "INVIGILATION";
  if (raw === "RESERVE" || raw.includes("احتياط")) return "RESERVE";
  if (raw === "REVIEW_FREE" || raw.includes("مراجعة")) return "REVIEW_FREE";
  if (raw === "CORRECTION_FREE" || raw.includes("تصحيح")) return "CORRECTION_FREE";
  return raw;
}

function buildMutationBlockReason(auth: any, tenantId: string) {
  if (!String(tenantId || "").trim()) return MISSING_TENANT_MSG_AR;
  if (isReadOnlyResultsSession(auth)) return MUTATION_BLOCK_MSG_AR;
  return "";
}

type Args = {
  run: any;
  tenantId: string;
  teacherNameToId: Map<string, string>;
  colKeyToExamId: Record<string, any>;
  examKeyToCommittees: Record<string, any>;
  invigilatorsPerRoomForSubject: (subject: string) => number;
  unavailIndex: any;
  unavailReasonMap: Map<string, string>;
  markCellBlocked: (teacherName: string, subColKey: string, msg: string) => void;
  normalizeSubject: (subject: string) => string;
  persistEditedAssignments: (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => void;
  displayDates: any[];
  dateToSubCols: Map<string, any[]>;
  allSubCols: any[];
  allTeachers: string[];
  matrix2: Record<string, any>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<string, any>;
  teacherTotals: Record<string, number>;
};

export function useResultsTableActions({
  run,
  tenantId,
  teacherNameToId,
  colKeyToExamId,
  examKeyToCommittees,
  invigilatorsPerRoomForSubject,
  unavailIndex,
  unavailReasonMap,
  markCellBlocked,
  normalizeSubject,
  persistEditedAssignments,
  displayDates,
  dateToSubCols,
  allSubCols,
  allTeachers,
  matrix2,
  committeesCountBySubCol,
  totalsDetailBySubCol,
  teacherTotals,
}: Args) {
  const auth = useAuth() as any;
  const mutationBlockReason = buildMutationBlockReason(auth, tenantId);
  const mutationDisabled = Boolean(mutationBlockReason);

  const blockMutation = (teacherName?: string, subColKey?: string) => {
    const msg = mutationBlockReason || MUTATION_BLOCK_MSG_AR;
    if (teacherName && subColKey) markCellBlocked(teacherName, subColKey, msg);
    else safeAlert(msg);
  };

  const getUnavailabilityReasonForCell = createResultsCellUnavailabilityResolver({
    teacherNameToId,
    unavailIndex,
    unavailReasonMap,
  });

  const dragDropActions = useResultsDragDropActions({
    run,
    colKeyToExamId,
    persistEditedAssignments,
    getUnavailabilityReasonForCell,
    markCellBlocked,
    normalizeSubject,
  });

  const deleteAssignmentByUid = mutationDisabled
    ? undefined
    : (uid: string) => {
        deleteAssignmentFromResultsRun({
          run,
          uid,
          normalizeSubject,
          persistEditedAssignments,
        });
      };

  const addTaskToEmptyCell = mutationDisabled
    ? undefined
    : (dstTeacher: string, dstColKey: string, taskType: string) => {
        addTaskToResultsEmptyCell({
          run,
          dstTeacher,
          dstColKey,
          taskType: normalizeManualTaskType(taskType),
          normalizeSubject,
          getUnavailabilityReasonForCell,
          markCellBlocked,
          teacherNameToId,
          colKeyToExamId,
          examKeyToCommittees,
          invigilatorsPerRoomForSubject,
          persistEditedAssignments,
        });
      };

  const deleteAssignmentsBySubCol = mutationDisabled
    ? undefined
    : (subColKey: string) => {
        deleteAssignmentsForSubColFromResultsRun({
          run,
          subColKey,
          normalizeSubject,
          persistEditedAssignments,
        });
      };

  const exportExcel = () => {
    exportExcelStyledLikeTable(
      buildResultsExcelExportPayload({
        run,
        displayDates,
        dateToSubCols,
        allSubCols,
        allTeachers,
        matrix2,
        committeesCountBySubCol,
        totalsDetailBySubCol,
        teacherTotals,
      })
    );
  };

  const noopBlockedDrop = (_srcUid?: string, dstTeacher?: string, dstColKey?: string) => {
    if (mutationDisabled) blockMutation(dstTeacher, dstColKey);
  };

  const noopBlockedSwap = () => {
    if (mutationDisabled) blockMutation();
  };

  return {
    getUnavailabilityReasonForCell,
    mutationDisabled,
    mutationBlockReason,
    swapAssignmentsByUid: mutationDisabled ? noopBlockedSwap : dragDropActions.swapAssignmentsByUid,
    moveAssignmentToColumnTeacher: mutationDisabled ? noopBlockedDrop : dragDropActions.moveAssignmentToColumnTeacher,
    handleDropToCell: mutationDisabled
      ? (_srcUid: string, dstTeacher: string, dstColKey: string) => blockMutation(dstTeacher, dstColKey)
      : dragDropActions.handleDropToCell,
    handleDropToEmptyCell: mutationDisabled ? noopBlockedDrop : dragDropActions.handleDropToEmptyCell,
    deleteAssignmentByUid,
    deleteAssignmentsBySubCol,
    addTaskToEmptyCell,
    exportExcel,
    getAssignmentsInCell,
    isDraggableTaskType: (taskType: any) => !mutationDisabled && isDraggableTaskType(taskType),
  };
}