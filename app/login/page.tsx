
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth-client";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const { setUser }   = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      setUser(user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">𖦹UbuTube</Link>
        <h1>Log in</h1>

        {searchParams.get("reset") && (
          <p className="auth-message auth-message--success">
            ✓ Password updated — please log in with your new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}

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
              type="password" value={password} required autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
            />
          </label>

          <Link href="/forgot-password" className="auth-link">Forgot password?</Link>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          No account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}