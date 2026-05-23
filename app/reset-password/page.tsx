"use client";
import { useState, type FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth-client";

function ResetContent() {
  const token    = useSearchParams().get("token") ?? "";
  const router   = useRouter();

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setError("");
    setLoading(true);
    try {
      await resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <h1>Reset password</h1>
        <p className="auth-error">Invalid or missing reset link.</p>
        <Link href="/forgot-password" className="auth-link">Request a new one</Link>
      </>
    );
  }

  return (
    <>
      <h1>Reset password</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="auth-error">{error}</p>}

        <label>
          New password
          <input
            type="password" value={password} required minLength={8}
            autoComplete="new-password" placeholder="Minimum 8 characters"
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <label>
          Confirm password
          <input
            type="password" value={confirm} required minLength={8}
            autoComplete="new-password"
            onChange={e => setConfirm(e.target.value)}
          />
        </label>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? "Resetting…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">𖦹UbuTube</Link>
        <Suspense fallback={<p className="auth-message">Loading…</p>}>
          <ResetContent />
        </Suspense>
      </div>
    </div>
  );
}