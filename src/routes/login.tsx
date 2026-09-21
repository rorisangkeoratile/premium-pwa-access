import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, Eye, EyeOff, Headphones, Home, LogIn, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/lesedi/shell";
import { OtpStep } from "@/components/lesedi/otp-step";
import { mockUsers, type MockUser } from "@/components/lesedi/data";
import { QUICK_LOGIN_ENABLED, cancelLogin, currentUser, pendingLogin, startLogin, startQuickLogin } from "@/lib/auth";
import { Logo } from "@/components/lesedi/logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — LesediLink" },
      { name: "description", content: "Log in to LesediLink to open your workspace." },
    ],
  }),
  component: LoginPage,
});

const roleIcons = { Customer: Home, Technician: Wrench, Dispatcher: Headphones, "Department manager": Building2 } as const;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<MockUser | null>(null);

  // Already signed in: go straight to that user's own dashboard. Half-finished login: resume at the PIN step.
  useEffect(() => {
    const session = currentUser();
    if (session) {
      navigate({ to: session.to, replace: true });
      return;
    }
    const waiting = pendingLogin();
    if (waiting?.purpose === "login") setPending(waiting.user);
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const user = await startLogin(email, password);
    setBusy(false);
    if (!user) {
      setError("Email or password is incorrect. Please try again.");
      return;
    }
    setError("");
    setPassword("");
    setPending(user);
  }

  function quickLogin(user: MockUser) {
    const started = startQuickLogin(user.email);
    if (started) setPending(started);
  }

  function backToLogin(message = "") {
    cancelLogin();
    setPending(null);
    setError(message);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-3" aria-label="LesediLink home">
            <Logo />
            <p className="text-lg font-extrabold text-navy">Lesedi<span className="text-primary">Link</span></p>
          </Link>
          <Button asChild variant="ghost" className="min-h-11"><Link to="/"><ArrowLeft /> Back to home</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-12 lg:py-16">
        {pending ? (
          <OtpStep user={pending} onDone={(user) => navigate({ to: user.to, replace: true })} onBack={backToLogin} />
        ) : (
          <>
            <p className="text-[11px] font-extrabold uppercase text-primary">Welcome back</p>
            <h1 className="mt-2 text-3xl font-extrabold text-navy">Log in to LesediLink</h1>
            <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6" noValidate>
              <Field id="email" label="Email address">
                <Input id="email" type="email" autoComplete="username" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field id="password" label="Password">
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-11 pr-12" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </Field>
              {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="min-h-12 w-full" disabled={busy}><LogIn /> Continue</Button>
              <p className="text-center text-sm text-muted-foreground">New to LesediLink? <Link to="/signup" className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline">Create an account</Link></p>
            </form>

            {QUICK_LOGIN_ENABLED && (
              <section className="mt-6" aria-labelledby="quick-login-heading">
                <h2 id="quick-login-heading" className="text-[11px] font-extrabold uppercase text-muted-foreground">Quick tap login</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {mockUsers.map((user) => {
                    const Icon = roleIcons[user.role];
                    return (
                      <Button key={user.email} type="button" variant="outline" className="h-auto min-h-14 justify-start gap-3 px-3 py-2 text-left" onClick={() => quickLogin(user)}>
                        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0"><span className="block text-sm font-bold">{user.role}</span><span className="block truncate text-[11px] font-normal text-muted-foreground">{user.name}</span></span>
                      </Button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
