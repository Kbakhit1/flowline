export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M6 7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-7l-5 4v-4h0a4 4 0 0 1-4-4z" fill="var(--primary)" />
      <path d="M12 13l4 4 4-4" stroke="var(--primary-foreground)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8v9" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
