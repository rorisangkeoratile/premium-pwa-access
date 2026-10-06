import { useState, type FormEvent } from "react";
import { MessageSquareHeart, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_TAGS, RATING_WORDS, submitFeedback } from "@/lib/feedback";
import { formatDuration } from "@/lib/metrics";
import type { OutageReport } from "@/lib/reports";

/**
 * Asks a resident how the city did, once their outage is resolved. The person who opened the incident
 * closes it by answering; a resident whose report was merged into it just adds their rating.
 */
export function FeedbackCard({ report, area, resolvedIn, onLater }: { report: OutageReport; area: string; resolvedIn: number | undefined; onLater: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [informed, setInformed] = useState<boolean | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const shown = hover || rating;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === 0) {
      setError("Choose a star rating first.");
      return;
    }
    submitFeedback(
      { reportId: report.id, incidentId: report.duplicateOf ?? report.id, by: report.reporter, rating, keptInformed: informed ?? true, tags, ...(comment.trim() ? { comment: comment.trim() } : {}) },
      !report.duplicateOf,
    );
  }

  const toggle = (tag: string) => setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));

  return (
    <form onSubmit={send} className="mt-5 rounded-md border-2 border-success bg-card p-5" aria-labelledby={`feedback-${report.id}`}>
      <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-success"><MessageSquareHeart className="size-4" /> Resolved · {report.id}</p>
      <h2 id={`feedback-${report.id}`} className="mt-2 text-lg font-extrabold text-navy">How did we do?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your outage in {area} is resolved{resolvedIn !== undefined ? `, ${formatDuration(resolvedIn)} after you reported it` : ""}. Your rating goes to the electricity department and helps the city serve your community better.</p>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold">Overall service</legend>
        <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"} · ${RATING_WORDS[value]}`} aria-pressed={rating === value} onMouseEnter={() => setHover(value)} onClick={() => { setRating(value); setError(""); }} className="grid size-11 place-items-center rounded-md hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
              <Star className={`size-7 ${value <= shown ? "fill-accent text-accent" : "text-muted-foreground"}`} />
            </button>
          ))}
          <span className="ml-2 text-sm font-bold text-navy">{RATING_WORDS[shown]}</span>
        </div>
        {error && <p role="alert" className="mt-1 text-xs font-bold text-destructive">{error}</p>}
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold">Did we keep you updated and meet the times we gave you?</legend>
        <div className="mt-2 flex gap-2">
          {[["Yes", true], ["No", false]].map(([label, value]) => (
            <Button key={String(label)} type="button" size="sm" className="min-h-11 min-w-20" variant={informed === value ? "default" : "outline"} aria-pressed={informed === value} onClick={() => setInformed(value as boolean)}>{label}</Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold">Anything stand out? <span className="font-normal text-muted-foreground">(optional)</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEEDBACK_TAGS.map((tag) => (
            <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => toggle(tag)} className={`min-h-11 rounded-full border px-3 text-xs font-bold ${tags.includes(tag) ? "border-primary bg-secondary text-primary" : "border-border"}`}>{tag}</button>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`comment-${report.id}`} className="mt-4 block text-sm font-bold">Comments <span className="font-normal text-muted-foreground">(optional)</span></label>
      <Textarea id={`comment-${report.id}`} className="mt-2 min-h-20" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tell us what went well, or what we could do better" />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="min-h-12 sm:min-w-48">Send feedback</Button>
        <Button type="button" variant="ghost" className="min-h-12" onClick={onLater}>Not now</Button>
      </div>
    </form>
  );
}
