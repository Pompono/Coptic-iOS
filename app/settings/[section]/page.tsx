import SettingsSubpage from '../Subpage';

export function generateStaticParams() {
  return ['preferences', 'learning', 'progress', 'keyboard', 'recovery', 'developer'].map(section => ({ section }));
}

export default function SettingsSectionPage() { return <SettingsSubpage/>; }
