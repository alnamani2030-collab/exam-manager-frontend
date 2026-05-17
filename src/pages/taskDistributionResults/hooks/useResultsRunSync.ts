import { useEffect, useState } from "react";
import { loadRun, RUN_UPDATED_EVENT, subscribeRunCloud } from "../../../utils/taskDistributionStorage";
import { ensureUidsOnRun } from "../uidUtils";
import {
  loadAndPersistResultsRun,
  loadAndPersistResultsRunFromCloud,
  shouldRefreshResultsRun,
} from "../services/resultsRunSyncHelpers";

export function useResultsRunSync(tenantId: string) {
  const [run, setRun] = useState(() => ensureUidsOnRun(loadRun(tenantId)));

  useEffect(() => {
    let cancelled = false;

    const apply = (nextRun: any) => {
      if (cancelled) return;
      setRun(ensureUidsOnRun(nextRun));
    };

    const refreshLocalCache = () => {
      const loaded = loadAndPersistResultsRun(tenantId);
      apply(loaded);
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
