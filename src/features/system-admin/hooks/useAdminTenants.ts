import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { isSameDirectorate, MINISTRY_SCOPE, normalizeText } from "../../../constants/directorates";
import type { TenantConfig, TenantDoc } from "../types";
import { isValidTenantId, slugifyTenantId } from "../services/adminSystemShared";

export function useAdminTenants(params: { isPlatformOwner: boolean; isSuper: boolean; profile: any }) {
  const { isPlatformOwner, isSuper, profile } = params;
  const [tenants, setTenants] = useState<TenantDoc[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantConfig, setSelectedTenantConfig] = useState<TenantConfig>({});
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantIdRaw, setNewTenantIdRaw] = useState("");
  const [newTenantEnabled, setNewTenantEnabled] = useState(true);
  const tenantsSnapSeqRef = useRef(0);

  const newTenantId = useMemo(() => slugifyTenantId(newTenantIdRaw), [newTenantIdRaw]);
  const canSaveTenant = useMemo(
    () => !!newTenantId && isValidTenantId(newTenantId) && !!newTenantName.trim(),
    [newTenantId, newTenantName],
  );
  const myGov = normalizeText(String((profile as any)?.governorate ?? ""));

  const visibleTenants = useMemo(() => {
    if (isPlatformOwner) return tenants;
    if (!isSuper) return tenants.filter((t) => t.id === (profile as any)?.tenantId);
    if (!myGov || myGov === normalizeText(MINISTRY_SCOPE)) return tenants;
    return tenants.filter((t) => isSameDirectorate(String((t as any)?.governorate ?? ""), myGov));
  }, [tenants, isPlatformOwner, isSuper, myGov, profile]);

  useEffect(() => {
    const qTenants = query(collection(db, "tenants"), orderBy("updatedAt", "desc"), limit(500));
    const unsub = onSnapshot(
      qTenants,
      (snap) => {
        const seq = ++tenantsSnapSeqRef.current;
        const listAll: TenantDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const list: TenantDoc[] = listAll.filter((t: any) => t?.deleted !== true);

        Promise.all(
          list.map(async (t) => {
            try {
              const cfgSnap = await getDoc(doc(db, "tenants", t.id, "meta", "config"));
              const cfg = cfgSnap.exists() ? (((cfgSnap.data() as any) || {})) : {};
              const displayName = String(cfg?.schoolNameAr || (t as any)?.name || t.id || "").trim();
              const governorate = String(cfg?.governorate || cfg?.regionAr || (t as any)?.governorate || "").trim();
              const enabled = (t as any)?.enabled !== false && cfg?.enabled !== false;
              const deleted = (t as any)?.deleted === true || cfg?.deleted === true;

              return {
                ...t,
                name: displayName,
                displayName,
                schoolNameAr: String(cfg?.schoolNameAr || "").trim(),
                governorate,
                enabled,
                deleted,
              } as TenantDoc;
            } catch {
              return t as TenantDoc;
            }
          }),
        ).then((withGovAll) => {
          if (seq !== tenantsSnapSeqRef.current) return;
          const withGov = withGovAll.filter((t: any) => t?.deleted !== true);
          setTenants(withGov);
          const stillExists = selectedTenantId && withGov.some((x) => x.id === selectedTenantId);
          if (!stillExists) {
            setSelectedTenantId(withGov.length ? withGov[0].id : null);
          }
        });
      },
      () => setTenants([]),
    );

    return () => unsub();
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId) return;
    let alive = true;

    (async () => {
      setLoadingConfig(true);
      try {
        const [tenantSnap, configSnap] = await Promise.all([
          getDoc(doc(db, "tenants", selectedTenantId)),
          getDoc(doc(db, "tenants", selectedTenantId, "meta", "config")),
        ]);
        if (!alive) return;
        const tenantData = tenantSnap.exists() ? (((tenantSnap.data() as any) || {})) : {};
        const configData = configSnap.exists() ? (((configSnap.data() as any) || {})) : {};
        setSelectedTenantConfig({
          ...tenantData,
          ...configData,
          schoolNameAr: String(configData?.schoolNameAr || tenantData?.name || selectedTenantId).trim(),
          governorate: String(configData?.governorate || configData?.regionAr || tenantData?.governorate || "").trim(),
          regionAr: String(configData?.regionAr || configData?.governorate || tenantData?.governorate || "").trim(),
          enabled: tenantData?.enabled !== false && configData?.enabled !== false,
        } as any);
      } catch {
        if (!alive) return;
        setSelectedTenantConfig({});
      } finally {
        if (alive) setLoadingConfig(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedTenantId]);

  return {
    tenants,
    visibleTenants,
    selectedTenantId,
    setSelectedTenantId,
    selectedTenantConfig,
    setSelectedTenantConfig,
    loadingConfig,
    newTenantName,
    setNewTenantName,
    newTenantIdRaw,
    setNewTenantIdRaw,
    newTenantId,
    newTenantEnabled,
    setNewTenantEnabled,
    canSaveTenant,
    isValidTenantId,
  };
}

export default useAdminTenants;
