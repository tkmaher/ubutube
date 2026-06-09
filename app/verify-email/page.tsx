"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

function VerifyContent() {
  const router        = useRouter();

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
    <>

      {status === "loading" && <div className="auth-message">Verifying your email…</div>}

      {status === "success" && (
        <>
          <div className="auth-message auth-message--success">✓ Email verified! You can now log in.</div>
          <button onClick={() => router.push("/login")} className="ubu-linkout" aria-label="Log in">
            Log in
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <div className="auth-error">{message || "Verification failed."}</div>
          <Link href="/signup" className="ubu-linkout linkout">Back to sign up</Link>
        </>
      )}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={<div>Loading…</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}