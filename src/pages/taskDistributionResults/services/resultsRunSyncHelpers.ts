import { loadRun, loadRunPreferCloud, saveRun } from '../../../utils/taskDistributionStorage';
import { ensureUidsOnRun } from '../uidUtils';

export function loadAndPersistResultsRun(tenantId: string) {
  const loaded = ensureUidsOnRun(loadRun(tenantId));
  try {
    saveRun(tenantId, loaded);
  } catch {
    // ignore persistence errors during refresh
  }
  return loaded;
}

export function shouldRefreshResultsRun(eventTenantId: string | null | undefined, currentTenantId: string) {
  const eventTid = String(eventTenantId || '').trim();
  const currentTid = String(currentTenantId || '').trim();
  return !eventTid || eventTid === currentTid;
}

export async function loadAndPersistResultsRunFromCloud(tenantId: string) {
  const loaded = await loadRunPreferCloud(tenantId);
  const withUids = ensureUidsOnRun(loaded);
  if (!withUids) return withUids;

  try {
    saveRun(tenantId, withUids as any, {
      silent: true,
      source: "results-cloud-sync",
      syncMaster: true,
    });
  } catch {
    // ignore persistence errors during cloud refresh
  }

  return withUids;
}
