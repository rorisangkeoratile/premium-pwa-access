/**
 * A repeating timer that keeps its pace in a hidden tab. Chrome slows ordinary timers in background tabs to
 * once a second and, after five minutes, to once a minute, which would make the sensors look dead (or a
 * technician look offline) while a presenter works in another window. A worker's timer is not slowed that
 * way. Returns a function that stops the timer.
 */
export function startTimer(callback: () => void, every: number): () => void {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${every});`], { type: "text/javascript" }));
    const worker = new Worker(url);
    worker.onmessage = callback;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = setInterval(callback, every);
    return () => clearInterval(id);
  }
}
