'use client';
import { usePathname } from 'next/navigation';
import SettingsHome from './SettingsHome';
import SettingsSubpage from './Subpage';
export default function SettingsNavigationHost() {
  const path = usePathname().replace(/\/$/, '');
  return <div className="settings-navigation-host" data-settings-phase="idle">
    <div data-settings-layer={path} key={path}>
      {path === '/settings' ? <SettingsHome/> : <SettingsSubpage section={path.split('/').at(-1) ?? ''}/>}
    </div>
  </div>;
}
