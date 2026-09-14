/** FlowLine mark: an F drawn as one flow line, with bubble nodes at its ends. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 54V14h26M20 32h18" stroke="var(--primary)" strokeWidth="7" />
      <circle cx="46" cy="14" r="6" fill="oklch(0.78 0.11 170)" />
      <circle cx="38" cy="32" r="6" fill="oklch(0.78 0.11 170)" />
      <circle cx="20" cy="54" r="6" fill="var(--background)" stroke="var(--primary)" strokeWidth="4" />
    </svg>
  );
}

/** Horizontal lockup used on the landing page: mark + English wordmark. */
export function LogoLockup({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: height * 0.28 }}>
      <Logo size={height} />
      <span
        dir="ltr"
        style={{ fontSize: height * 0.78, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.015em" }}
      >
        Flow<span style={{ color: "var(--primary)" }}>Line</span>
      </span>
    </span>
  );
}
