export function generateStaticParams() {
  return ['preferences', 'learning', 'progress', 'recovery', 'developer'].map(section => ({ section }));
}
export default function SettingsSectionPage() { return null; }
