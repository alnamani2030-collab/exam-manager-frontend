import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "../auth/AuthContext";
import CloudBackup from "./CloudBackup";

function normalizeEmailAccessCode(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function maskEmailForAccess(email: string): string {
  const normalized = String(email || "").trim();
  if (!normalized.includes("@")) return normalized ? "****" : "";
  const [name, domain] = normalized.split("@");
  if (!name) return `****@${domain || ""}`;
  if (name.length <= 2) return `${name[0] || "*"}***@${domain || ""}`;
  return `${name[0]}${"*".repeat(Math.max(3, name.length - 2))}${name[name.length - 1]}@${domain || ""}`;
}

function normalizeEmailForAccessCheck(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function EmailCodeGate({
  tenantId,
  currentUserEmail,
  sessionKey,
  page,
  pageLabel,
  onVerified,
}: {
  tenantId: string;
  currentUserEmail: string;
  sessionKey: string;
  page: string;
  pageLabel: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const maskedEmail = useMemo(() => maskEmailForAccess(currentUserEmail), [currentUserEmail]);

  const sendCode = useCallback(async () => {
    if (!tenantId) {
      setError("معرف المركز غير متوفر.");
      return;
    }

    const expectedEmail = normalizeEmailForAccessCheck(currentUserEmail);
    const enteredEmail = normalizeEmailForAccessCheck(confirmEmail);

    if (!expectedEmail) {
      setEmailConfirmed(false);
      setError("البريد الإلكتروني المسجل للحساب غير متوفر.");
      return;
    }

    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setEmailConfirmed(false);
      setCodeSent(false);
      setCode("");
      setError("البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.");
      return;
    }

    setEmailConfirmed(true);
    setSending(true);
    setError("");
    setMessage("");

    try {
      const fn = httpsCallable(getFunctions(undefined, "us-central1"), "sendControl12AccessCodeEmail");
      const result = await fn({
        tenantId,
        page,
        pageLabel,
      });
      const data = (result.data || {}) as any;
      setCodeSent(true);
      setMessage(data?.message || "تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.");
    } catch (err: any) {
      console.error(`send ${page} access code failed:`, err);
      setError(err?.message || "تعذر إرسال رمز الدخول إلى البريد الإلكتروني.");
    } finally {
      setSending(false);
    }
  }, [confirmEmail, currentUserEmail, page, pageLabel, tenantId]);

  const verifyCode = useCallback(async () => {
    const normalized = normalizeEmailAccessCode(code);
    if (normalized.length !== 6) {
      setError("أدخل رمزًا مكونًا من 6 أرقام.");
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");

    try {
      const fn = httpsCallable(getFunctions(undefined, "us-central1"), "verifyControl12AccessCode");
      await fn({ tenantId, code: normalized, page });
      try {
        window.sessionStorage.setItem(sessionKey, "1");
      } catch {
        // Ignore storage failures; the current state still unlocks the page.
      }
      setCode("");
      setMessage("تم التحقق بنجاح.");
      onVerified();
    } catch (err: any) {
      console.error(`verify ${page} access code failed:`, err);
      setError(err?.message || "رمز الدخول غير صحيح أو انتهت صلاحيته.");
    } finally {
      setVerifying(false);
    }
  }, [code, onVerified, page, sessionKey, tenantId]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(180, 137, 37, 0.55)",
    background: "#fffdf5",
    color: "#000",
    fontWeight: 900,
    fontSize: 18,
    outline: "none",
    textAlign: "center",
    letterSpacing: 4,
    boxSizing: "border-box",
  };

  const emailInputStyle: React.CSSProperties = {
    ...inputStyle,
    direction: "ltr",
    textAlign: "center",
    letterSpacing: 0,
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid rgba(164, 120, 24, 0.55)",
    borderRadius: 16,
    padding: "12px 18px",
    background: "linear-gradient(135deg, #fff8df, #e5c769)",
    color: "#000",
    fontWeight: 900,
    fontSize: 15,
    cursor: sending || verifying ? "not-allowed" : "pointer",
    opacity: sending || verifying ? 0.7 : 1,
  };

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #fff9e8, #f6edcf)",
        padding: 24,
        color: "#000",
        fontWeight: 900,
      }}
    >
      <section
        style={{
          width: "min(760px, 100%)",
          borderRadius: 28,
          border: "2px solid rgba(201, 164, 70, 0.55)",
          background: "rgba(255, 255, 255, 0.94)",
          boxShadow: "0 22px 55px rgba(94, 64, 8, 0.18)",
          padding: 28,
          color: "#000",
          fontWeight: 900,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "7px 14px",
            borderRadius: 999,
            border: "1px solid rgba(201, 164, 70, 0.7)",
            background: "#fff7db",
            color: "#000",
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          تحقق أمني
        </div>

        <h1 style={{ margin: "0 0 10px", fontSize: 30, color: "#000", fontWeight: 900 }}>
          رمز دخول عبر البريد الإلكتروني
        </h1>
        <p style={{ margin: "0 0 18px", lineHeight: 1.9, color: "#000", fontWeight: 900 }}>
          لحماية صفحة {pageLabel}، أدخل البريد الإلكتروني الصحيح للحساب أولًا، ثم اطلب رمز الدخول.
        </p>

        <div
          style={{
            border: "1px solid rgba(201, 164, 70, 0.45)",
            borderRadius: 18,
            padding: 16,
            background: "#fffaf0",
            marginBottom: 16,
            color: "#000",
            fontWeight: 900,
          }}
        >
          البريد المسجل: <span style={{ color: "#000", fontWeight: 900 }}>{maskedEmail || "غير متوفر"}</span>
        </div>

        <label style={{ display: "block", marginBottom: 8, color: "#000", fontWeight: 900 }}>
          أدخل البريد الإلكتروني الخاص بالحساب
        </label>
        <input
          value={confirmEmail}
          onChange={(event) => {
            setConfirmEmail(event.target.value);
            setEmailConfirmed(false);
            setCodeSent(false);
            setCode("");
            setMessage("");
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void sendCode();
          }}
          inputMode="email"
          autoComplete="email"
          placeholder="example@domain.com"
          style={emailInputStyle}
        />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, marginBottom: 16 }}>
          <button type="button" onClick={sendCode} disabled={sending || verifying} style={buttonStyle}>
            {sending
              ? "جاري إرسال الرمز..."
              : codeSent
                ? "إعادة إرسال الرمز"
                : "تأكيد البريد وإرسال رمز الدخول"}
          </button>
        </div>

        {emailConfirmed && codeSent ? (
          <>
            <label style={{ display: "block", marginBottom: 8, color: "#000", fontWeight: 900 }}>
              رمز التحقق
            </label>
            <input
              value={code}
              onChange={(event) => setCode(normalizeEmailAccessCode(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verifyCode();
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              style={inputStyle}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <button type="button" onClick={verifyCode} disabled={verifying || sending} style={buttonStyle}>
                {verifying ? "جاري التحقق..." : "تأكيد الرمز وفتح الصفحة"}
              </button>
            </div>
          </>
        ) : null}

        {message ? (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              border: "1px solid rgba(22, 101, 52, 0.28)",
              background: "#ecfdf5",
              color: "#000",
              fontWeight: 900,
              padding: 14,
            }}
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              border: "1px solid rgba(185, 28, 28, 0.28)",
              background: "#fff1f2",
              color: "#000",
              fontWeight: 900,
              padding: 14,
            }}
          >
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/**
 * Diploma protected page.
 *
 * This wrapper keeps the diploma route/page explicit and requires
 * an email verification code before the shared page is mounted.
 */
export default function CloudBackup12() {
  const auth = useAuth() as any;
  const tenantId = useMemo(
    () => String(auth?.effectiveTenantId || auth?.tenantId || auth?.user?.tenantId || "").trim(),
    [auth?.effectiveTenantId, auth?.tenantId, auth?.user?.tenantId]
  );
  const currentUserEmail = useMemo(
    () => String(auth?.user?.email || auth?.profile?.email || auth?.userProfile?.email || "").trim(),
    [auth?.user?.email, auth?.profile?.email, auth?.userProfile?.email]
  );
  const sessionKey = useMemo(() => `exam-manager:cloudbackup12-email-code-access:${tenantId}`, [tenantId]);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVerified(window.sessionStorage.getItem(sessionKey) === "1");
  }, [sessionKey]);

  if (!verified) {
    return (
      <EmailCodeGate
        tenantId={tenantId}
        currentUserEmail={currentUserEmail}
        sessionKey={sessionKey}
        page="CloudBackup12"
        pageLabel="النسخ السحابي"
        onVerified={() => setVerified(true)}
      />
    );
  }

  return <CloudBackup />;
}
