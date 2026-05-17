import { useEffect, useRef, useState } from "react";
import { loadRun, RUN_UPDATED_EVENT, subscribeRunCloud } from "../../../utils/taskDistributionStorage";
import { ensureUidsOnRun } from "../uidUtils";
import {
  loadAndPersistResultsRun,
  loadAndPersistResultsRunFromCloud,
  shouldRefreshResultsRun,
} from "../services/resultsRunSyncHelpers";

function getLocalResultsRunSignature(run: any) {
  try {
    const assignments = Array.isArray(run?.assignments) ? run.assignments : [];

    return JSON.stringify({
      runId: String(run?.runId || ""),
      createdAtISO: String(run?.createdAtISO || ""),
      count: assignments.length,
      assignments: assignments.map((assignment: any, index: number) => ({
        id: String(assignment?.__uid || assignment?.id || index),
        teacherId: String(assignment?.teacherId || ""),
        teacherName: String(assignment?.teacherName || ""),
        dateISO: String(assignment?.dateISO || assignment?.date || ""),
        period: String(assignment?.period || ""),
        taskType: String(assignment?.taskType || ""),
        subject: String(assignment?.subject || ""),
        roomNo: String(assignment?.roomNo || assignment?.committeeNo || ""),
        invigilatorIndex: String(assignment?.invigilatorIndex || ""),
      })),
    });
  } catch {
    return "";
  }
}

export function useResultsRunSync(tenantId: string) {
  const [run, setRun] = useState(() => ensureUidsOnRun(loadRun(tenantId)));
  const lastSignatureRef = useRef(getLocalResultsRunSignature(run));
  const refreshingRef = useRef(false);

  useEffect(() => {
    lastSignatureRef.current = getLocalResultsRunSignature(run);
  }, [run]);

  useEffect(() => {
    let cancelled = false;

    const apply = (nextRun: any) => {
      if (cancelled) return;
      const ensured = ensureUidsOnRun(nextRun);
      const nextSignature = getLocalResultsRunSignature(ensured);

      if (nextSignature !== lastSignatureRef.current) {
        lastSignatureRef.current = nextSignature;
        setRun(ensured);
      }
    };

    const refreshLocalCache = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        apply(loadAndPersistResultsRun(tenantId));
      } finally {
        window.setTimeout(() => {
          refreshingRef.current = false;
        }, 0);
      }
    };

    const refreshCloudFirst = () => {
      void loadAndPersistResultsRunFromCloud(tenantId)
        .then((loaded) => apply(loaded))
        .catch(() => refreshLocalCache());
    };

    refreshLocalCache();
    refreshCloudFirst();

    const unsubscribeCloud = subscribeRunCloud(
      tenantId,
      (cloudRun) => apply(cloudRun || loadRun(tenantId)),
      () => undefined,
    );

    const onFocus = () => refreshCloudFirst();

    const onUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      const source = String(e?.detail?.source || "").trim();

      if (source === "results-sync" || source === "results-cloud-sync") return;

      if (shouldRefreshResultsRun(tid, tenantId)) refreshCloudFirst();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(RUN_UPDATED_EVENT, onUpdated as any);

    return () => {
      cancelled = true;
      unsubscribeCloud();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(RUN_UPDATED_EVENT, onUpdated as any);
    };
  }, [tenantId]);

  return { run, setRun };
}
