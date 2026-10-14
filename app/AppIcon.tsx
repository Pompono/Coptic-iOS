import HeritageIcon from './HeritageIcon';
export type IconName = 'arrow' | 'settings' | 'return' | 'home' | 'book' | 'learn' | 'translate' | 'search' | 'scan' | 'check' | 'lock' | 'close' | 'review' | 'chevron' | 'copy' | 'cross' | 'play' | 'reader';
/** Original Coptic identity icons alongside quiet utility symbols. */
export default function AppIcon({ name, size = 20 }: { name: IconName; size?: number }) {
 if (["book","learn","translate","home","settings","cross"].includes(name)) return <HeritageIcon name={name as "book"|"learn"|"translate"|"home"|"settings"|"cross"} size={size}/>;
 const paths:Partial<Record<IconName,React.ReactNode>>={
 play:<path d="m8 4 12 8-12 8Z"/>,
 arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,return:<path d="M20 5v7H4m5-5-5 5 5 5"/>,
 reader:<><path d="M12 5C8 3 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-1-10 1Z"/><path d="M12 5v15"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 scan:<><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M4 12h16"/></>,
 check:<path d="m5 12 4 4L19 6"/>,lock:<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
 close:<path d="m6 6 12 12M18 6 6 18"/>,review:<><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/><path d="M12 7v5l3 2"/></>,
 chevron:<path d="m9 5 7 7-7 7"/>,copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
