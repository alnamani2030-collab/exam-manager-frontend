import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, resolveHomePath } from "../features/authz";

export default function RootRedirect() {
  const auth = useAuth() as any;

  if (auth?.loading) return null;

  const snapshot = buildAuthzSnapshot({
    user: auth?.user,
    profile: auth?.profile || auth?.userProfile || null,
    isSuperAdmin: !!auth?.isSuperAdmin,
    isSuper: !!auth?.isSuper,
    tenantId: auth?.tenantId ?? auth?.profile?.tenantId ?? auth?.userProfile?.tenantId ?? null,
    supportTenantId: auth?.supportTenantId ?? null,
    supportUntil: typeof auth?.supportUntil === "number" ? auth.supportUntil : null,
    isSupportMode: !!auth?.isSupportMode,
  });

  return <Navigate to={resolveHomePath(snapshot)} replace />;
}
