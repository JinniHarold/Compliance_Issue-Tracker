import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Demo-only shortcuts for reviewers; these match the seed script and are documented in the README
const DEMO = [
  { email: "admin@tracker.local", label: "Admin" },
  { email: "maria@tracker.local", label: "Owner (Maria)" },
  { email: "john@tracker.local", label: "Owner (John)" },
  { email: "auditor@tracker.local", label: "Auditor" },
];
const DEMO_PASSWORD = "Demo@12345";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900";

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold">Compliance Tracker</h1>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" autoComplete="username" required className={input}
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" type="password" autoComplete="current-password" required className={input}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={busy}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
          <p className="text-sm text-slate-600">Demo accounts (seed data only)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button key={d.email} type="button"
                onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setError(null); }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs hover:bg-slate-100">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
