import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquareText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MockUser } from "@/components/lesedi/data";
import { OTP_LENGTH, OTP_RESEND_MS, SHOW_DEMO_OTP, demoOtp, maskPhone, pendingLogin, resendOtp, verifyOtp } from "@/lib/auth";

/** The 6-digit code screen, shared by log-in and sign-up. */
export function OtpStep({ user, onDone, onBack, backLabel = "Use a different account", heading = "Enter your 6-digit code" }: { user: MockUser; onDone: (user: MockUser) => void; onBack: (message?: string) => void; backLabel?: string; heading?: string }) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const refreshTiming = () => {
    const waiting = pendingLogin();
    setCooldown(waiting ? Math.max(0, Math.ceil((waiting.issuedAt + OTP_RESEND_MS - Date.now()) / 1000)) : 0);
    setDemoCode(demoOtp());
  };

  useEffect(() => {
    refreshTiming();
    boxes.current[0]?.focus();
    const timer = setInterval(refreshTiming, 1000);
    return () => clearInterval(timer);
  }, []);

  function fill(next: string[]) {
    setDigits(next);
    setError("");
    if (next.every(Boolean)) verify(next.join(""));
  }

  function verify(code: string) {
    const result = verifyOtp(code);
    if (result.status === "ok") return onDone(result.user);
    if (result.status === "expired") return onBack("That code has expired. Please log in again to get a new one.");
    if (result.status === "locked") return onBack("Too many wrong codes. Please log in again to get a new one.");
    setError(`That code is not right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`);
    setDigits(Array(OTP_LENGTH).fill(""));
    boxes.current[0]?.focus();
  }

  function onChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) return fill(digits.map((digit, i) => (i === index ? "" : digit)));
    const next = [...digits];
    cleaned.split("").slice(0, OTP_LENGTH - index).forEach((char, offset) => { next[index + offset] = char; });
    fill(next);
    boxes.current[Math.min(index + cleaned.length, OTP_LENGTH - 1)]?.focus();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    fill(Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? ""));
    boxes.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (digits.every(Boolean)) verify(digits.join(""));
    else setError(`Enter all ${OTP_LENGTH} digits.`);
  }

  function resend() {
    if (resendOtp()) {
      setDigits(Array(OTP_LENGTH).fill(""));
      setError("");
      refreshTiming();
      boxes.current[0]?.focus();
    }
  }

  return (
    <>
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-primary"><ShieldCheck className="size-4" /> Two-step verification</p>
      <h1 className="mt-2 text-3xl font-extrabold text-navy">{heading}</h1>
      <p className="mt-2 text-muted-foreground">We sent a code to {maskPhone(user.phone)} for {user.name}. It expires in 5 minutes.</p>

      <form onSubmit={submit} className="mt-6 rounded-xl border border-border bg-card p-6" noValidate>
        <fieldset>
          <legend className="sr-only">One-time PIN, {OTP_LENGTH} digits</legend>
          <div className="flex justify-between gap-2">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => { boxes.current[index] = node; }}
                value={digit}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={OTP_LENGTH}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(index, event)}
                onPaste={onPaste}
                onFocus={(event) => event.target.select()}
                className="h-14 w-full min-w-0 rounded-md border border-input bg-card text-center text-2xl font-extrabold text-navy shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-sm font-bold text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="mt-5 min-h-12 w-full"><ShieldCheck /> Verify and sign in</Button>
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={resend} disabled={cooldown > 0}>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</Button>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => onBack()}>{backLabel}</Button>
        </div>
      </form>

      {SHOW_DEMO_OTP && demoCode && (
        <aside className="mt-6 rounded-xl border border-dashed border-border bg-secondary p-4" aria-label="Demo phone">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-muted-foreground"><MessageSquareText className="size-4" /> Demo phone · {maskPhone(user.phone)}</p>
          <p className="mt-2 rounded-lg bg-card p-3 text-sm">LesediLink: your login code is <strong className="text-lg tracking-widest text-navy">{demoCode}</strong>. Never share it with anyone.</p>
          <p className="mt-2 text-[11px] text-muted-foreground">This prototype has no SMS service, so the code is shown here. It is turned off with <code>SHOW_DEMO_OTP</code> in auth.ts.</p>
        </aside>
      )}
    </>
  );
}
