"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { register } from "@/lib/auth-client";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(username, email, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Link href="/" className="auth-logo">𖦹UbuTube</Link>
          <h1>Check your email</h1>
          <p className="auth-message">
            We sent a verification link to <strong>{email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="auth-btn auth-btn--inline">Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">𖦹UbuTube</Link>
        <h1>Create account</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}

          <label>
            Username
            <input
              type="text" value={username} required minLength={3} maxLength={32}
              autoComplete="username" placeholder="3–32 characters"
              onChange={e => setUsername(e.target.value)}
            />
          </label>

          <label>
            Email
            <input
              type="email" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password" value={password} required minLength={8}
              autoComplete="new-password" placeholder="Minimum 8 characters"
              onChange={e => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}