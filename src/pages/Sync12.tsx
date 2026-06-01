import React from "react";
import Sync from "./Sync";

/**
 * Diploma sync page.
 *
 * This wrapper keeps the diploma route/page explicit as Sync12,
 * while reusing the shared Sync logic. Sync detects /sync12 and
 * links to cloud-health12 / cloud-backup12.
 */
export default function Sync12() {
  return <Sync />;
}
