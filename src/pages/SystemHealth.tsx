import React, { useEffect, useState } from "react";
import { getSystemHealth, Health } from "../utils/systemHealth";
import { useI18n } from "../i18n/I18nProvider";

export default function SystemHealth() {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {

    const update = () => {
      const data = getSystemHealth();
      setHealth(data);
    };

    update();

    const interval = setInterval(update, 5000);

    return () => clearInterval(interval);

  }, []);

  if (!health) return null;

  return (
    <div style={{ padding: 20 }}>

      <h2>{tr("مراقبة صحة النظام", "System Health Monitor")}</h2>

      <p>{tr("المعلمون", "Teachers")}: {health.teachers}</p>

      <p>{tr("الاختبارات", "Exams")}: {health.exams}</p>

      <p>{tr("الأرشيف", "Archives")}: {health.archives}</p>

      <p>{tr("السحابة", "Cloud")}: {health.cloud}</p>

      <p>{tr("آخر نسخة احتياطية", "Last backup")}: {health.lastBackup}</p>

    </div>
  );
}
