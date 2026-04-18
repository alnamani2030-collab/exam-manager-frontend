import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { subscribeTenantArray } from "../services/tenantData";
import { buildSmartAlerts } from "../services/smartAlerts.service";
import { useI18n } from "../i18n/I18nProvider";
import { tenantPath } from "../config/tenantRoutes";

const SUBS = {
  teachers: "teachers",
  exams: "exams",
  rooms: "rooms",
  roomBlocks: "roomBlocks",
} as const;

const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";


type SmartAlertItem = {
  id?: string;
  title?: string;
  message?: string;
  titleAr?: string;
  titleEn?: string;
  messageAr?: string;
  messageEn?: string;
  level?: string;
  route?: string;
};

function localizeSmartAlert(alert: SmartAlertItem, lang: string): SmartAlertItem {
  const useArabic = lang === "ar";
  const title = String(alert?.title || "").trim();
  const message = String(alert?.message || "").trim();
  const id = String(alert?.id || "").trim().toLowerCase();

  if (useArabic) {
    return {
      ...alert,
      title: String(alert?.titleAr || title).trim(),
      message: String(alert?.messageAr || message).trim(),
    };
  }

  if (alert?.titleEn || alert?.messageEn) {
    return {
      ...alert,
      title: String(alert?.titleEn || title).trim(),
      message: String(alert?.messageEn || message).trim(),
    };
  }

  const stableTitleAr = "الوضع التشغيلي مستقر";
  const stableMessageAr = "لا توجد Warning حرجة ظاهرة الآن، ويمكن متابعة التشغيل بصورة آمنة.";

  if (
    id in { stable: 1, operational_stable: 1, healthy: 1 } ||
    title == stableTitleAr ||
    title == "الحالة التشغيلية مستقرة" ||
    message == stableMessageAr ||
    (alert?.level === "success" && /warning/i.test(message) && /لا توجد|لا يوجد/.test(message))
  ) {
    return {
      ...alert,
      title: "Operational status is stable",
      message: "There are no critical warnings right now, and operations can continue safely.",
    };
  }

  return {
    ...alert,
    title: title.replace(/التنبيهات الذكية المباشرة/g, "Live smart alerts"),
    message,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { effectiveTenantId, userProfile } = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const tenantId = String(effectiveTenantId || "").trim();
  const go = (path: string) => {
    const p = String(path || "").trim();
    if (!p) return;
    if (!tenantId) {
      navigate("/");
      return;
    }
    navigate(tenantPath(tenantId, p));
  };

  const displayName =
    (userProfile?.displayName || "").trim() ||
    (userProfile?.email ? String(userProfile.email).split("@")[0] : "") ||
    tr("مستخدم", "User");

  const [counts, setCounts] = useState({
    teachers: 0,
    exams: 0,
    rooms: 0,
    blocks: 0,
  });
  const [alertsModel, setAlertsModel] = useState({
    teachers: [] as any[],
    exams: [] as any[],
    rooms: [] as any[],
    roomBlocks: [] as any[],
    examRoomAssignments: [] as any[],
  });

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .dash3DBar {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        background: linear-gradient(145deg, #111827, #0b1220);
        border: 1px solid rgba(255,215,0,0.18);
        box-shadow:
          0 18px 40px rgba(0,0,0,0.65),
          inset 0 2px 0 rgba(255,255,255,0.05);
      }
      .dash3DBar::before {
        content: "";
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
        transform: skewX(-12deg);
        animation: dashShine 10s infinite;
        pointer-events: none;
      }
      @keyframes dashShine {
        0%, 88% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
        90% { opacity: 1; }
        100% { transform: translateX(240%) skewX(-12deg); opacity: 0.9; }
      }
      .dashStat {
        background: linear-gradient(145deg, rgba(212,175,55,0.14), rgba(212,175,55,0.06));
        border: 1px solid rgba(212,175,55,0.35);
        border-radius: 14px;
        padding: 10px 16px;
        color: ${GOLD_DARK};
        box-shadow:
          0 10px 22px rgba(0,0,0,0.55),
          inset 0 1px 0 rgba(255,255,255,0.05);
      }
      .dashGoldSep {
        width: 2px;
        align-self: stretch;
        background: rgba(184,134,11,0.95);
        box-shadow: 0 0 10px rgba(184,134,11,0.35);
        border-radius: 999px;
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      try {
        document.head.removeChild(styleEl);
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const unsubs = [
      subscribeTenantArray<any>(tenantId, SUBS.teachers, (teachers) => {
        setCounts((prev) => ({ ...prev, teachers: teachers.length }));
        setAlertsModel((prev) => ({ ...prev, teachers }));
      }),
      subscribeTenantArray<any>(tenantId, SUBS.exams, (exams) => {
        setCounts((prev) => ({ ...prev, exams: exams.length }));
        setAlertsModel((prev) => ({ ...prev, exams }));
      }),
      subscribeTenantArray<any>(tenantId, SUBS.rooms, (rooms) => {
        setCounts((prev) => ({ ...prev, rooms: rooms.length }));
        setAlertsModel((prev) => ({ ...prev, rooms }));
      }),
      subscribeTenantArray<any>(tenantId, SUBS.roomBlocks, (roomBlocks) => {
        setCounts((prev) => ({ ...prev, blocks: roomBlocks.length }));
        setAlertsModel((prev) => ({ ...prev, roomBlocks }));
      }),
      subscribeTenantArray<any>(tenantId, "examRoomAssignments", (examRoomAssignments) => {
        setAlertsModel((prev) => ({ ...prev, examRoomAssignments }));
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [tenantId]);

  const quickCards = useMemo(
    () => [
      { num: "01", title: tr("بيانات الكادر التعليمي", "Teachers Data"), sub: tr("إدارة الكادر التعليمي والأنصبة", "Manage teachers and workloads"), to: "/teachers", accent: "#60a5fa", icon: "👨‍🏫" },
      { num: "02", title: tr("جدول الامتحانات", "Exam Schedule"), sub: tr("المواعيد والقاعات والمواضيع", "Dates, rooms, and subjects"), to: "/exams", accent: "#34d399", icon: "📅" },
      { num: "03", title: tr("توزيع المهام", "Task Distribution"), sub: tr("التوزيع الذكي مراقبة واحتياط", "Smart assignment for invigilation and reserve"), to: "/task-distribution/run", accent: "#fbbf24", icon: "🔄" },
      { num: "04", title: tr("التقارير والكشوفات", "Reports & Sheets"), sub: tr("الكشوفات اليومية والرسمية", "Daily and formal reports"), to: "/task-distribution/print", accent: "#f87171", icon: "📊" },
    ],
    [lang]
  );


  const smartAlerts = useMemo(() => buildSmartAlerts(alertsModel).map((alert: SmartAlertItem) => localizeSmartAlert(alert, lang)), [alertsModel, lang]);

  const longRows = useMemo(
    () => [
      { title: tr("بيانات المدرسة", "School Profile"), sub: tr("الهوية والشعار والإعدادات", "Identity, logo, and settings"), to: "/settings1", icon: "🏫", accent: "#ef4444" },
      { title: tr("مكتبة الصور", "Gallery"), sub: tr("إدارة الشعارات والملفات", "Manage logos and files"), to: "/gallery", icon: "🖼️", accent: "#0ea5e9" },
      { title: tr("مصمم البرنامج", "About Developer"), sub: tr("معلومات المطور والإصدارات", "Developer info and versions"), to: "/about", icon: "🛠️", accent: "#ec4899" },
      { title: tr("قاعدة البيانات", "Database"), sub: tr("النسخ الاحتياطي والاستيراد", "Backup and import tools"), to: "/sync", icon: "💾", accent: "#6366f1" },
      { title: tr("أرشيف التوزيعات", "Distribution Archive"), sub: tr("السجلات المحفوظة والتاريخ", "Saved history and snapshots"), to: "/archive", icon: "📁", accent: "#94a3b8" },
    ],
    [lang]
  );

  return (
    <div
      style={{
        direction: isRTL ? "rtl" : "ltr",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(212,175,55,0.14), transparent 24%), radial-gradient(circle at 88% 18%, rgba(59,130,246,0.10), transparent 24%), linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        color: GOLD_DARK,
        padding: window.innerWidth < 768 ? "16px" : "32px",
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 38%, transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -120,
          top: 260,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10), transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1520,
          margin: "0 auto 22px auto",
          display: "grid",
          gap: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            border: "1px solid rgba(212,175,55,0.18)",
            borderRadius: 34,
            padding: 28,
            background:
              "linear-gradient(135deg, rgba(30,22,2,0.95), rgba(8,8,8,0.98), rgba(27,21,3,0.94))",
            boxShadow:
              "0 32px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 14, maxWidth: 900 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {tr("لوحة قيادة تشغيلية مباشرة", "Live executive control center")}
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,241,196,0.88)", marginBottom: 10 }}>
                  {tr("منظومة إدارة الامتحانات", "Exam Management Suite")}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(34px, 5vw, 68px)",
                    lineHeight: 1.04,
                    fontWeight: 950,
                    color: "#fff1c4",
                    letterSpacing: "-0.03em",
                    textShadow: "0 8px 28px rgba(212,175,55,0.16)",
                  }}
                >
                  {tr("لوحة التحكم الذكية", "Smart Dashboard")}
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 2,
                  color: "rgba(255,241,196,0.82)",
                  maxWidth: 960,
                }}
              >
                {tr(
                  "هذه الصفحة تمنح الإدارة رؤية تنفيذية شاملة لحالة الكادر والامتحانات والقاعات والتنبيهات الذكية، ضمن واجهة مؤسسية فاخرة تساعد على الوصول السريع واتخاذ القرار بثقة من اللحظة الأولى.",
                  "This page gives leadership an executive overview of teachers, exams, rooms, and live smart alerts in a premium interface built for clarity, speed, and confident decision-making from the first moment."
                )}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: tr("المستخدم الحالي", "Current user"), value: displayName },
                  { label: tr("اللغة", "Language"), value: lang === "ar" ? "العربية" : "English" },
                  { label: tr("حالة الجهة", "Tenant status"), value: tenantId ? tr("مرتبطة", "Connected") : tr("غير مرتبطة", "Not connected") },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      borderRadius: 18,
                      padding: "12px 14px",
                      minWidth: 190,
                      boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#fff8dc", fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                minWidth: 300,
                maxWidth: 390,
                width: "100%",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
                padding: 22,
                background: "linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: smartAlerts.length ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)",
                  border: smartAlerts.length ? "1px solid rgba(16,185,129,0.24)" : "1px solid rgba(245,158,11,0.24)",
                  color: smartAlerts.length ? "#a7f3d0" : "#fde68a",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {smartAlerts.length ? tr("تنبيهات ذكية نشطة", "Smart alerts live") : tr("بانتظار البيانات الحية", "Waiting for live data")}
              </div>

              <div style={{ fontSize: 30, lineHeight: 1.45, fontWeight: 950, color: "#fff1c4" }}>
                {tr(
                  "الوصول إلى أهم أقسام النظام أصبح أسرع وأفخم مع إبراز مباشر للحالة التشغيلية.",
                  "Access to the system’s core areas is now faster and more premium, with live operational visibility."
                )}
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.95, color: "rgba(255,241,196,0.78)" }}>
                {tr(
                  "الواجهة المطورة ترفع من جودة الانطباع الأول وتمنح المستخدم تجربة تنقل منظمة بين التوزيع، التقارير، السجلات، والإعدادات.",
                  "The upgraded interface improves first impression quality and gives users a cleaner journey across distribution, reports, records, and settings."
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="dash3DBar" style={{ padding: 16, marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => go("/task-distribution")}
              style={{
                padding: "12px 20px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #4f46e5dd, #7c3aeddd)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.12)",
                fontWeight: 800,
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 14px 0 rgba(0,0,0,0.22), 0 18px 45px rgba(79,70,229,0.35)",
              }}
            >
              <span style={{ fontSize: 20 }}>▦</span>
              {tr("توزيع المهام", "Task Distribution")}
            </button>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,215,0,0.28)",
                background: "rgba(255,215,0,0.08)",
                color: "#ffd700",
                fontWeight: 800,
              }}
            >
              {tr("مرحباً", "Welcome")}, <b>{displayName}</b>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="dashStat">{tr("الكادر التعليمي", "Teachers")} <strong>{counts.teachers}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("الامتحانات", "Exams")} <strong>{counts.exams}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("القاعات", "Rooms")} <strong>{counts.rooms}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("حظر قاعات", "Room blocks")} <strong>{counts.blocks}</strong></div>
            <div className="dashGoldSep" />
            <div className="dashStat">{tr("إجمالي العناصر", "Total items")} <strong>{counts.teachers + counts.exams + counts.rooms + counts.blocks}</strong></div>
          </div>
        </div>
      </div>

      <div style={{
        display: "grid",
        gap: 14,
        marginBottom: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: GOLD_DARK, textShadow: `0 0 14px ${GOLD_GLOW}` }}>{tr("التنبيهات الذكية المباشرة", "Live smart alerts")}</h2>
          <button onClick={() => go("/audit")} style={{ padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(255,215,0,0.25)", background: "rgba(255,215,0,0.08)", color: "#ffd700", fontWeight: 800, cursor: "pointer" }}>{tr("سجل العمليات", "Audit log")}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {smartAlerts.map((alert) => {
            const tone = alert.level === "critical" ? "#ef4444" : alert.level === "warning" ? "#f59e0b" : alert.level === "success" ? "#22c55e" : "#38bdf8";
            return (
              <button key={alert.id} onClick={() => go(alert.route || "/analytics")} style={{ textAlign: isRTL ? "right" : "left", background: "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(2,6,23,0.96))", border: `1px solid ${tone}55`, borderRadius: 24, padding: 18, color: "#f8e7a8", boxShadow: "0 14px 34px rgba(0,0,0,0.45)", cursor: "pointer" }}>
                <div style={{ color: tone, fontWeight: 900, marginBottom: 8 }}>{alert.title}</div>
                <div style={{ color: "#e5e7eb", lineHeight: 1.8 }}>{alert.message}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18, position: "relative", zIndex: 1 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: GOLD_DARK, textShadow: `0 0 14px ${GOLD_GLOW}` }}>
          {tr("الوصول السريع", "Quick access")}
        </h2>
        <div style={{ color: "#e8c670", opacity: 0.92, fontWeight: 800 }}>
          {tr("أهم العمليات في مسار واحد أنيق", "Core actions in one elegant flow")}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28, marginBottom: 56, position: "relative", zIndex: 1 }}>
        {quickCards.map((card) => (
          <button
            key={card.to}
            onClick={() => go(card.to)}
            style={{
              height: 180,
              borderRadius: 32,
              padding: "32px 36px",
              background: `linear-gradient(145deg, ${card.accent}22, ${card.accent}0a)`,
              border: `1px solid ${card.accent}55`,
              boxShadow: `0 20px 55px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 30px ${card.accent}40`,
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              position: "relative",
              overflow: "hidden",
              backdropFilter: "blur(10px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-16px) scale(1.06)";
              e.currentTarget.style.boxShadow = `0 40px 90px rgba(0,0,0,0.75), 0 0 80px ${card.accent}80`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = `0 20px 55px rgba(0,0,0,0.6), 0 0 30px ${card.accent}40`;
            }}
          >
            <div style={{ position: "absolute", top: 20, right: isRTL ? 32 : undefined, left: !isRTL ? 32 : undefined, fontSize: 90, fontWeight: 900, opacity: 0.09, color: GOLD_DARK }}>
              {card.num}
            </div>

            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", textAlign: isRTL ? "right" : "left" }}>
              <div>
                <div style={{ fontSize: 44, marginBottom: 12, color: GOLD_DARK, textShadow: `0 0 12px ${GOLD_GLOW}` }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 10, color: GOLD_DARK, textShadow: `0 0 10px ${GOLD_GLOW}` }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 15, color: "#e8c670", opacity: 0.9 }}>{card.sub}</div>
              </div>
              <div style={{ alignSelf: isRTL ? "flex-end" : "flex-start", fontSize: 40, opacity: 0.55, color: GOLD_DARK }}>{isRTL ? "←" : "→"}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, textAlign: "center", marginBottom: 28, color: GOLD_DARK, textShadow: `0 0 14px ${GOLD_GLOW}` }}>
          {tr("الإعدادات والسجلات", "Settings & Records")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(390px, 1fr))", gap: 24 }}>
          {longRows.map((item) => (
            <button
              key={item.title}
              onClick={() => go(item.to)}
              style={{
                height: 120,
                borderRadius: 26,
                padding: "0 32px",
                background: "rgba(30,41,59,0.68)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 16px 45px rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                gap: 28,
                cursor: "pointer",
                transition: "all 0.32s ease",
                backdropFilter: "blur(12px)",
                flexDirection: isRTL ? "row" : "row",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-9px)";
                e.currentTarget.style.boxShadow = "0 30px 80px rgba(0,0,0,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 16px 45px rgba(0,0,0,0.55)";
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 20,
                  background: `${item.accent}22`,
                  color: item.accent,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 32,
                  border: `1px solid ${item.accent}60`,
                  boxShadow: `0 10px 25px ${item.accent}40`,
                }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1, textAlign: isRTL ? "right" : "left" }}>
                <div style={{ fontWeight: 700, fontSize: 18.5, color: GOLD_DARK, textShadow: `0 0 9px ${GOLD_GLOW}` }}>{item.title}</div>
                <div style={{ fontSize: 14.5, color: "#e8c670", opacity: 0.9, marginTop: 6 }}>{item.sub}</div>
              </div>
              <div style={{ fontSize: 32, opacity: 0.6, color: GOLD_DARK }}>{isRTL ? "←" : "→"}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 120 }} />
    </div>
  );
}
