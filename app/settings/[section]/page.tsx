import SettingsSubpage from '../Subpage';

export function generateStaticParams() {
  return ['learning', 'progress', 'keyboard', 'developer'].map(section => ({ section }));
}

export default function SettingsSectionPage() { return <SettingsSubpage/>; }
