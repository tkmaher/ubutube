"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/auth-client";

function VerifyContent() {
  const token = useSearchParams().get("token") ?? "";
  const [status,  setStatus]  = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No token found in URL."); return; }
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(err => { setStatus("error"); setMessage(err.message); });
  }, [token]);

  return (
    <div className="auth-card">
      <Link href="/" className="auth-logo">𖦹UbuTube</Link>
      <h1>Email Verification</h1>

      {status === "loading" && <p className="auth-message">Verifying your email…</p>}

      {status === "success" && (
        <>
          <p className="auth-message auth-message--success">✓ Email verified! You can now log in.</p>
          <Link href="/login" className="auth-btn auth-btn--inline">Log in</Link>
        </>
      )}

      {status === "error" && (
        <>
          <p className="auth-error">{message || "Verification failed."}</p>
          <Link href="/signup" className="auth-link">Back to sign up</Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div className="auth-card"><p className="auth-message">Loading…</p></div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}