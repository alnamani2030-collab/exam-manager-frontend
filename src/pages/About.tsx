import React from "react";
import { useNavigate } from "react-router-dom";

const glass: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.62)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
  borderRadius: 26,
};

const gold = "#fbbf24";
const goldSoft = "rgba(251,191,36,0.16)";
const glowGold = "0 0 24px rgba(251,191,36,0.22), 0 0 60px rgba(251,191,36,0.10)";
const textMain = "#f8fafc";
const textMuted = "rgba(248,250,252,0.78)";
const textSoft = "rgba(248,250,252,0.58)";

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: textMain,
  marginBottom: 18,
};

export default function About() {
  const navigate = useNavigate();

  const infoCards = [
    { icon: "🏫", title: "المدرسة الحالية", value: "مدرسة عزان بن تميم" },
    { icon: "🏢", title: "جهة العمل", value: "المديرية العامة للتعليم بمحافظة شمال الشرقية" },
    { icon: "📞", title: "التواصل", value: "97760020" },
    { icon: "💼", title: "المسمى الوظيفي", value: "فني مختبرات مدارس" },
  ];

  const systemFeatures = [
    "توزيع ذكي وعادل للمراقبين حسب القيود والجاهزية",
    "إدارة كاملة للمعلمين والامتحانات والقاعات والحظر",
    "تقارير وكشوفات رسمية للطباعة بصيغة احترافية",
    "إحصائيات توزيع فورية واكتشاف العجز تلقائيًا",
    "إدارة نسخ وأرشفة وتوثيق السجلات والنشاط",
    "قابلية توسع للمدارس والإدارات والصلاحيات متعددة الأدوار",
  ];

  const technologies = [
    "React",
    "TypeScript",
    "Firebase",
    "Firestore",
    "Cloud Functions",
    "IndexedDB",
    "Excel Import/Export",
    "AI Integration",
  ];

  const achievements = [
    { number: "100%", label: "منظومة متكاملة لإدارة الامتحانات" },
    { number: "24/24", label: "جاهزية تشغيل ومتابعة" },
    { number: "A4", label: "تقارير احترافية للطباعة والتسليم" },
    { number: "Multi-Role", label: "صلاحيات متعددة وإدارة مركزية" },
  ];

  return (
    <div
      style={{
        direction: "rtl",
        minHeight: "100vh",
        color: textMain,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: `
          radial-gradient(circle at 10% 10%, rgba(251,191,36,0.08), transparent 24%),
          radial-gradient(circle at 85% 20%, rgba(96,165,250,0.09), transparent 22%),
          linear-gradient(180deg, #08111f 0%, #060d18 45%, #040910 100%)
        `,
      }}
    >
      <style>{`
        @keyframes aboutFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aboutPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(251,191,36,0.0), 0 0 28px rgba(251,191,36,0.16); }
          50% { box-shadow: 0 0 0 rgba(251,191,36,0.0), 0 0 38px rgba(251,191,36,0.28); }
        }
        .about-card-hover {
          transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
        }
        .about-card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 55px rgba(0,0,0,0.42), 0 0 24px rgba(251,191,36,0.14);
          border-color: rgba(251,191,36,0.28) !important;
        }
        .about-chip {
          transition: all 0.25s ease;
        }
        .about-chip:hover {
          transform: translateY(-2px);
          background: rgba(251,191,36,0.18) !important;
          border-color: rgba(251,191,36,0.5) !important;
        }
      `}</style>

      <div style={{ width: "92%", maxWidth: 1500, margin: "0 auto", padding: "28px 0 42px" }}>
        <header
          style={{
            ...glass,
            padding: "28px 34px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            animation: "aboutFadeUp 0.7s ease",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.88), rgba(88,28,135,0.55), rgba(30,41,59,0.92))",
            border: "1px solid rgba(251,191,36,0.18)",
            boxShadow: glowGold,
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#111827",
                boxShadow: glowGold,
                animation: "aboutPulse 2.8s ease-in-out infinite",
              }}
            >
              👨‍💻
            </div>

            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>مصمم البرنامج</div>
              <div style={{ marginTop: 6, fontSize: 15, color: textMuted }}>
                واجهة تعريف احترافية تليق بمنظومة إدارة الامتحانات المطورة
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)",
              color: "#fff",
              fontWeight: 800,
              border: "1px solid rgba(251,191,36,0.25)",
              boxShadow: glowGold,
            }}
          >
            إصدار النظام المتقدم
          </div>
        </header>

        <section
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "minmax(320px, 380px) 1fr",
            gap: 28,
            alignItems: "stretch",
            animation: "aboutFadeUp 0.9s ease",
          }}
        >
          <div
            style={{
              ...glass,
              padding: "30px 24px",
              textAlign: "center",
              border: "1px solid rgba(251,191,36,0.16)",
            }}
            className="about-card-hover"
          >
            <div
              style={{
                width: 164,
                height: 164,
                margin: "0 auto",
                borderRadius: "50%",
                padding: 6,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                boxShadow: glowGold,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "linear-gradient(180deg, #0f172a, #111827)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 72,
                }}
              >
                👨‍💻
              </div>
            </div>

            <div style={{ marginTop: 22, fontSize: 28, fontWeight: 900, color: "#fff" }}>
              يوسف راشد النعماني
            </div>

            <div
              style={{
                marginTop: 12,
                display: "inline-block",
                padding: "8px 18px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#111827",
                fontWeight: 900,
                boxShadow: glowGold,
              }}
            >
              Full Stack Developer
            </div>

            <p style={{ marginTop: 18, lineHeight: 1.95, fontSize: 15, color: textMuted }}>
              مطور متخصص في بناء الأنظمة المؤسسية الذكية، يركز على تحويل الإجراءات
              الإدارية المعقدة إلى حلول رقمية متكاملة، دقيقة، وقابلة للتوسع.
            </p>

            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 15,
                  background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                  color: "#111827",
                  boxShadow: glowGold,
                }}
              >
                العودة للصفحة السابقة
              </button>

              <button
                onClick={() => navigate("/")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 15,
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                }}
              >
                الذهاب إلى لوحة التحكم
              </button>
            </div>
          </div>

          <div
            style={{
              ...glass,
              padding: "30px",
              border: "1px solid rgba(251,191,36,0.14)",
            }}
            className="about-card-hover"
          >
            <div style={sectionTitleStyle}>رسالة هذا العمل</div>

            <p style={{ lineHeight: 2, fontSize: 16, color: textMuted, margin: 0 }}>
              هذا النظام ليس مجرد صفحة لإدارة بيانات الامتحانات، بل هو منظومة تشغيل
              متكاملة صُممت لتقديم تجربة احترافية تبدأ من إدخال الكادر وجدول الامتحانات
              والقاعات، وتمر عبر التوزيع الذكي والتقارير والإحصائيات، وتنتهي بإخراج
              كشوفات رسمية دقيقة تليق بالعمل المؤسسي في البيئة التعليمية.
            </p>

            <div
              style={{
                marginTop: 26,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              {achievements.map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...glass,
                    padding: "18px 16px",
                    border: "1px solid rgba(251,191,36,0.12)",
                    textAlign: "center",
                    background: "rgba(255,255,255,0.03)",
                  }}
                  className="about-card-hover"
                >
                  <div style={{ fontSize: 28, fontWeight: 900, color: gold }}>{item.number}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: textMuted }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginTop: 30, animation: "aboutFadeUp 1.05s ease" }}>
          <div style={sectionTitleStyle}>البيانات المهنية</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {infoCards.map((item) => (
              <div
                key={item.title}
                style={{
                  ...glass,
                  padding: "22px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                className="about-card-hover"
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                    color: "#111827",
                    fontSize: 22,
                    boxShadow: glowGold,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>

                <div>
                  <div style={{ fontSize: 13, color: textSoft }}>{item.title}</div>
                  <div style={{ marginTop: 5, fontWeight: 800, color: textMain }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 24,
            animation: "aboutFadeUp 1.2s ease",
          }}
        >
          <div
            style={{
              ...glass,
              padding: 28,
              border: "1px solid rgba(251,191,36,0.14)",
            }}
            className="about-card-hover"
          >
            <div style={sectionTitleStyle}>نبذة متقدمة عن النظام</div>

            <p style={{ lineHeight: 2, fontSize: 15.5, color: textMuted, margin: 0 }}>
              تم تصميم نظام إدارة الامتحانات المطور ليخدم بيئة تشغيل حقيقية تحتاج إلى
              سرعة، موثوقية، عدالة في التوزيع، ووضوح كامل في التقارير. وتم الاهتمام
              بالتفاصيل التشغيلية الدقيقة مثل توزيع المراقبين، إدارة القاعات، كشف العجز،
              التنبيهات، الربط الذكي بين البيانات، والطباعة الرسمية المناسبة للاعتماد
              الإداري.
            </p>

            <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
              {systemFeatures.map((feature, i) => (
                <div
                  key={feature}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: goldSoft,
                      color: gold,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ lineHeight: 1.85, color: textMuted, fontSize: 14.5 }}>{feature}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              ...glass,
              padding: 28,
              border: "1px solid rgba(251,191,36,0.14)",
            }}
            className="about-card-hover"
          >
            <div style={sectionTitleStyle}>التقنيات المستخدمة</div>

            <p style={{ lineHeight: 1.9, color: textMuted, fontSize: 15 }}>
              تم بناء النظام بأسلوب حديث يجمع بين واجهات الاستخدام المتقدمة، إدارة
              الحالة، التخزين السحابي، وقابلية التوسع مستقبلًا.
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {technologies.map((tech) => (
                <div
                  key={tech}
                  className="about-chip"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "rgba(251,191,36,0.10)",
                    border: "1px solid rgba(251,191,36,0.28)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {tech}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 26,
                padding: "18px 16px",
                borderRadius: 20,
                background: "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(96,165,250,0.08))",
                border: "1px solid rgba(251,191,36,0.18)",
                boxShadow: glowGold,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 17, color: "#fff", marginBottom: 8 }}>
                قيمة المشروع
              </div>
              <div style={{ color: textMuted, lineHeight: 1.9, fontSize: 14.5 }}>
                هذا العمل يمثل منتجًا مؤسسيًا فعليًا، وليس مجرد نموذج تجريبي؛ إذ يجمع
                بين التصميم، المنطق التشغيلي، دقة البيانات، والتقارير التنفيذية في منصة
                واحدة متكاملة.
              </div>
            </div>
          </div>
        </section>

        <footer
          style={{
            ...glass,
            marginTop: 34,
            padding: "22px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            border: "1px solid rgba(251,191,36,0.14)",
            animation: "aboutFadeUp 1.35s ease",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>نظام إدارة الامتحانات المطور</div>
            <div style={{ marginTop: 6, color: textSoft, fontSize: 13 }}>
              صفحة تعريف احترافية بمصمم المنظومة ورؤية المشروع التقني
            </div>
          </div>

          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(251,191,36,0.10)",
              border: "1px solid rgba(251,191,36,0.24)",
              color: gold,
              fontWeight: 800,
            }}
          >
            Built with vision, precision, and care
          </div>
        </footer>
      </div>
    </div>
  );
}
