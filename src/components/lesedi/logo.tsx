/**
 * The LesediLink mark. It always sits beside the "LesediLink" wordmark, so the image itself is decorative.
 * The supplied artwork has a wide margin, so it is scaled up a little inside the tile to keep the bolt readable at 40px.
 */
export function Logo({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`${className} block shrink-0 overflow-hidden rounded-md shadow`}>
      <img src="/logo.jpg" alt="" width={40} height={40} className="size-full scale-[1.4] object-cover" />
    </span>
  );
}
