"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { register } from "@/lib/auth-client";
import { useRouter } from "next/navigation";


export default function SignupPage() {
  const router        = useRouter();

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
        <div>
          We sent a verification link to <strong>{email}</strong>.
          Click it to activate your account.
        </div>
        <Link href="/login" className="linkout ubu-linkout">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <label>
            <div>Username</div>
            <input
              type="username" value={username} required minLength={3} maxLength={32}
              autoComplete="username" placeholder="3–32 characters"
              onChange={e => setUsername(e.target.value)} id="username"
              autoCorrect="off" 
              autoCapitalize="off" 
              spellCheck="false" 
            />
          </label>

          <label>
            <div>Email</div>
            <input
              type="email" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)} id="email"
              autoCorrect="off" 
              autoCapitalize="off" 
              spellCheck="false" 
            />
          </label>

          <label>
            <div>Password</div>
            <input
              type="password" value={password} required minLength={8}
              autoComplete="new-password" placeholder="Minimum 8 characters"
              onChange={e => setPassword(e.target.value)} id="password"
              autoCorrect="off" 
              autoCapitalize="off" 
              spellCheck="false" 
            />
          </label>

          <button type="submit" className="ubu-linkout" disabled={loading} aria-label="Create account">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div>
          Already have an account? 
          <button onClick={() => router.push("/login")} aria-label="Log in">
            Log in
          </button>
        </div>
    </div>
  );
}