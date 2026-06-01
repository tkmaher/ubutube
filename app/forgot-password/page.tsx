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

        {sent ? (
          <div className="auth-message">
            If that email is registered, we sent a reset link. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <div>Email</div>
              <input
                type="email" value={email} required autoComplete="email"
                onChange={e => setEmail(e.target.value)}
              />
            </label>
            <button type="submit" className="ubu-linkout" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="linkout ubu-linkout">Back to login</Link>
    </div>
  );
}