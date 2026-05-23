"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await forgotPassword(email); }
    finally { setSent(true); setLoading(false); }
    // Always show success — backend never reveals whether email exists
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">𖦹UbuTube</Link>
        <h1>Forgot password</h1>

        {sent ? (
          <p className="auth-message">
            If that email is registered, we sent a reset link. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email
              <input
                type="email" value={email} required autoComplete="email"
                onChange={e => setEmail(e.target.value)}
              />
            </label>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          <Link href="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}