import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Eye, EyeOff, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/lesedi/shell";
import { OtpStep } from "@/components/lesedi/otp-step";
import type { MockUser } from "@/components/lesedi/data";
import { areas } from "@/lib/nodes";
import { cancelLogin, currentUser, emailTaken, pendingLogin, startSignup } from "@/lib/auth";
import { Logo } from "@/components/lesedi/logo";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create an account — LesediLink" },
      { name: "description", content: "Create a LesediLink resident account to report power outages and follow repairs live." },
    ],
  }),
  component: SignupPage,
});

const SA_PHONE = /^(\+27|0)[0-9]{9}$/;
const cleanPhone = (value: string) => value.replace(/[\s()-]/g, "");
const OTHER_AREA = "other";

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "A lower-case and an upper-case letter", test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: "A number", test: (value: string) => /\d/.test(value) },
  { label: "A symbol, e.g. # ! $", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

type Form = { name: string; phone: string; email: string; areaId: string; password: string; confirm: string; consent: boolean };
type Errors = { [K in keyof Form]?: string | undefined };

function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim().split(/\s+/).filter(Boolean).length < 2) errors.name = "Enter your first name and surname.";
  if (!SA_PHONE.test(cleanPhone(form.phone))) errors.phone = "Enter a valid South African cell number, e.g. 082 000 0000 or +27 82 000 0000.";
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  else if (emailTaken(form.email)) errors.email = "An account with this email already exists. Please log in instead.";
  if (!form.areaId) errors.areaId = "Choose the area you live in.";
  if (!passwordRules.every((rule) => rule.test(form.password))) errors.password = "Your password does not meet all the rules below.";
  if (form.confirm !== form.password) errors.confirm = "The two passwords do not match.";
  if (!form.consent) errors.consent = "Please agree so we can contact you about your reports.";
  return errors;
}

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({ name: "", phone: "", email: "", areaId: "", password: "", confirm: "", consent: false });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<MockUser | null>(null);

  // Already signed in: go to the dashboard. Half-finished sign-up: resume at the code step.
  useEffect(() => {
    const session = currentUser();
    if (session) {
      navigate({ to: session.to, replace: true });
      return;
    }
    const waiting = pendingLogin();
    if (waiting?.purpose === "signup") setPending(waiting.user);
  }, [navigate]);

  const set = (key: keyof Form) => (event: { target: { value: string; checked?: boolean; type?: string } }) => {
    const value = event.target.type === "checkbox" ? Boolean(event.target.checked) : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => (document.querySelector('[role="alert"]') as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setBusy(true);
    const area = areas.find((item) => item.id === form.areaId);
    const result = await startSignup({ name: form.name, email: form.email, phone: form.phone, password: form.password, area: area?.name ?? "Tshwane", areaId: area?.id });
    setBusy(false);
    if (!result.ok) {
      setErrors({ email: result.error });
      return;
    }
    setMessage("");
    setForm((current) => ({ ...current, password: "", confirm: "" }));
    setPending(result.user);
  }

  function back(note = "") {
    cancelLogin();
    setPending(null);
    setMessage(note);
  }

  const passed = passwordRules.filter((rule) => rule.test(form.password)).length;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-3" aria-label="LesediLink home">
            <Logo />
            <p className="text-lg font-extrabold text-navy">Lesedi<span className="text-primary">Link</span></p>
          </Link>
          <Button asChild variant="ghost" className="min-h-11"><Link to="/login"><ArrowLeft /> Back to log in</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12 lg:py-16">
        {pending ? (
          <OtpStep user={pending} heading="Confirm your cell number" backLabel="Change my details" onDone={(user) => navigate({ to: user.to, replace: true })} onBack={back} />
        ) : (
          <>
            <p className="text-[11px] font-extrabold uppercase text-primary">New to LesediLink?</p>
            <h1 className="mt-2 text-3xl font-extrabold text-navy">Create your account</h1>
            <p className="mt-2 text-muted-foreground">Report power outages and follow the repair live. We'll text a 6-digit code to confirm your cell number.</p>
            {message && <p role="status" className="mt-4 rounded-md bg-warning-soft p-3 text-sm font-bold">{message}</p>}

            <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6" noValidate>
              <Field id="name" label="Full name" error={errors.name}>
                <Input id="name" autoComplete="name" className="h-11" aria-invalid={Boolean(errors.name)} value={form.name} onChange={set("name")} placeholder="First name and surname" />
              </Field>
              <Field id="phone" label="Cell number" hint="The code is sent here." error={errors.phone}>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" className="h-11" aria-invalid={Boolean(errors.phone)} value={form.phone} onChange={set("phone")} placeholder="e.g. 082 000 0000" />
              </Field>
              <Field id="email" label="Email address" hint="You will use this to log in." error={errors.email}>
                <Input id="email" type="email" autoComplete="email" className="h-11" aria-invalid={Boolean(errors.email)} value={form.email} onChange={set("email")} placeholder="you@example.com" />
              </Field>
              <Field id="areaId" label="Where do you live?" hint="So we can warn you about outages in your area." error={errors.areaId}>
                <select id="areaId" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" aria-invalid={Boolean(errors.areaId)} value={form.areaId} onChange={set("areaId")}>
                  <option value="">Choose your area</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  <option value={OTHER_AREA}>Somewhere else in Tshwane</option>
                </select>
              </Field>

              <Field id="password" label="Password" error={errors.password}>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" className="h-11 pr-12" aria-invalid={Boolean(errors.password)} value={form.password} onChange={set("password")} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {passwordRules.map((rule, index) => <span key={rule.label} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index < passed ? (passed === passwordRules.length ? "bg-success" : "bg-accent") : "bg-muted"}`} />)}
                </div>
                <ul className="space-y-1 text-xs">
                  {passwordRules.map((rule) => {
                    const ok = rule.test(form.password);
                    return <li key={rule.label} className={`flex items-center gap-2 ${ok ? "text-success" : "text-muted-foreground"}`}><Check className={`size-3.5 transition-opacity ${ok ? "opacity-100" : "opacity-30"}`} aria-hidden="true" />{rule.label}<span className="sr-only">{ok ? " (done)" : " (not yet)"}</span></li>;
                  })}
                </ul>
              </Field>
              <Field id="confirm" label="Confirm password" error={errors.confirm}>
                <Input id="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" className="h-11" aria-invalid={Boolean(errors.confirm)} value={form.confirm} onChange={set("confirm")} />
              </Field>

              <div className="space-y-2">
                <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={form.consent} onChange={set("consent")} aria-invalid={Boolean(errors.consent)} /><span>I agree that LesediLink and the City of Tshwane may contact me about my reports, and may use my details to respond to outages.</span></label>
                {errors.consent && <p role="alert" className="text-xs font-bold text-destructive">{errors.consent}</p>}
              </div>

              <Button type="submit" size="lg" className="min-h-12 w-full" disabled={busy}><UserPlus /> {busy ? "Creating…" : "Create account and send code"}</Button>
              <p className="text-center text-sm text-muted-foreground">Already registered? <Link to="/login" className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline">Log in</Link></p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
