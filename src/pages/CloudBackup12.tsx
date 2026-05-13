import React from "react";
import CloudBackup from "./CloudBackup";

/**
 * Diploma cloud backup page.
 *
 * This wrapper keeps the diploma route/page explicit as CloudBackup12,
 * while reusing the approved shared CloudBackup logic.
 * CloudBackup already detects the /cloud-backup12 route and starts in diploma mode.
 */
export default function CloudBackup12() {
  return <CloudBackup />;
}
