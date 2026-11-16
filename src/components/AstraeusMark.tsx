/**
 * The Astraeus mark: a forecast density curve that rises to a peak like an "A", crossed by its 80% interval, with a star
 * above the peak (Astraeus, the Titan of the stars and winds). Drawn in currentColor so it follows the surrounding text.
 * The same geometry is used for public/favicon.svg.
 */
export function AstraeusMark({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path d="M4 20c4.2 0 5-12.5 8-12.5S15.8 20 20 20" />
      <path d="M8.6 15.4h6.8" strokeWidth={1.6} />
      <circle cx="12" cy="3.4" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
