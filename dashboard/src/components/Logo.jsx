export function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" />
      <path d="M16 16 L8.2 9" />
      <path d="M16 16 L23.8 9" />
      <path d="M16 16 L16 24.2" />
      <circle cx="8.2" cy="9" r="2.15" />
      <circle cx="23.8" cy="9" r="2.15" />
      <circle cx="16" cy="24.2" r="2.15" />
      <circle cx="16" cy="16" r="3.15" />
    </svg>
  );
}
