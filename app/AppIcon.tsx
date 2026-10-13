type IconName = "arrow" | "settings" | "return";

/** Small monochrome SVGs; never rely on platform emoji rendering. */
export default function AppIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "arrow" && <path d="M5 12h14m-6-6 6 6-6 6" />}
    {name === "return" && <path d="M20 5v7H4m5-5-5 5 5 5" />}
    {name === "settings" && <><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;
}
