import React from "react";
import CloudStorageHealth from "./CloudStorageHealth";

/**
 * Diploma cloud health page.
 *
 * This wrapper gives the diploma section a real page identity at:
 * /t/:tenantId/cloud-health12
 *
 * The shared CloudStorageHealth component keeps the same health-check logic,
 * while the route and Layout12 links stay separated from the school route:
 * /t/:tenantId/cloud-health
 */
export default function CloudStorageHealth12() {
  return <CloudStorageHealth />;
}
            