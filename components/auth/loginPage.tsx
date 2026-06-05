
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
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        {searchParams.get("reset") && (
          <p>
            ✓ Password updated — please log in with your new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <label>
            <div>Email</div>
            <input
              type="email" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)} id="email"
            />
          </label>

          <label>
            <div>Password</div>
            <input
              type="password" value={password} required autoComplete="current-password"
              onChange={e => setPassword(e.target.value)} id="password"
            />
          </label>

        <Link href="/forgot-password" className="linkout ubu-linkout">Forgot password?</Link>

          <button type="submit" className="ubu-linkout" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <div>
          No account? <button onClick={() => router.push("/signup")}>Sign up</button>
        </div>

    </>
  );
}