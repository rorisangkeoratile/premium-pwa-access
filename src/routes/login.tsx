import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LogIn, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/lesedi/shell";
import { currentUser, signIn } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — LesediLink" },
      { name: "description", content: "Log in to LesediLink to open your workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Already signed in: go straight to that user's own dashboard.
  useEffect(() => {
    const session = currentUser();
    if (session) navigate({ to: session.to, replace: true });
  }, [navigate]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const user = signIn(email, password);
    if (!user) {
      setError("Email or password is incorrect. Please try again.");
      return;
    }
    setError("");
    navigate({ to: user.to, replace: true });
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-3" aria-label="LesediLink home">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="size-5" aria-hidden="true" /></div>
            <p className="text-lg font-extrabold text-navy">Lesedi<span className="text-primary">Link</span></p>
          </Link>
          <Button asChild variant="ghost" className="min-h-11"><Link to="/"><ArrowLeft /> Back to home</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-12 lg:py-16">
        <p className="text-[11px] font-extrabold uppercase text-primary">Welcome back</p>
        <h1 className="mt-2 text-3xl font-extrabold text-navy">Log in to LesediLink</h1>
        <p className="mt-2 text-muted-foreground">Sign in and we'll take you to your workspace.</p>
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
          <Button type="submit" size="lg" className="min-h-12 w-full"><LogIn /> Log in</Button>
        </form>
      </main>
    </div>
  );
}
