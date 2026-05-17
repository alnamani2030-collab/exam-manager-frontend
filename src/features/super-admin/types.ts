export type SuperSystemTenant = {
  id: string;
  name?: string;
  schoolName?: string;
  tenantName?: string;
  enabled?: boolean;
  governorate?: string;
  tenantGovernorate?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  [key: string]: unknown;
};

export type SuperSystemAllowRole =
  | "super_admin"
  | "ministry_super"
  | "super"
  | "governorate_super"
  | "exam_super"
  | "tenant_admin"
  | "admin" // legacy compatibility
  | "school_admin"
  | "user";

export type SuperSystemAllowDoc = {
  email: string;
  enabled: boolean;
  role: SuperSystemAllowRole;
  tenantId: string;
  governorate?: string;
  tenantGovernorate?: string;
  userName?: string;
  schoolName?: string;
  tenantName?: string;
  name?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  [key: string]: unknown;
};

export type SuperPortalActionCard = {
  key: string;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
};

export type SuperProgramTenantRow = {
  id: string;
  name?: string;
  schoolName?: string;
  enabled?: boolean;
  governorate?: string;
  tenantGovernorate?: string;
  [key: string]: unknown;
};
