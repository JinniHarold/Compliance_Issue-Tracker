import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Alert, AuroraBackground, Button, Card, Field, TextInput } from "../components/ui";

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

  return (
    <>
      <AuroraBackground />
      <main className="login-content grid min-h-screen place-items-center px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-center text-2xl font-semibold">Compliance Tracker</h1>
          <Card variant="login" className="rounded-xl p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <Field id="email" label="Email">
                <TextInput id="email" type="email" autoComplete="username" required className="login-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field id="password" label="Password">
                <TextInput id="password" type="password" autoComplete="current-password" required className="login-input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {error && <Alert>{error}</Alert>}
              <Button type="submit" disabled={busy} className="login-submit w-full">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Card>
          <div className="login-demo rounded-xl border border-dashed p-4">
            <p className="text-sm">Demo accounts (seed data only)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setError(null); }}
                  className="login-demo-account rounded-md px-2.5 py-1 text-xs"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
