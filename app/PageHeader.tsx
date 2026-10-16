import type { ReactNode } from 'react';
import AppIcon, { type IconName } from './AppIcon';

/** Every destination starts with the same title and original artwork. */
export default function PageHeader({ title, icon, children }: {
  title: string;
  icon: IconName;
  children?: ReactNode;
}) {
  return <header className="page-header">
    <div className="page-header__title"><h1>{title}</h1><span className="page-header__identity"><AppIcon name={icon} size={34}/></span></div>
    {children && <div className="page-header__actions">{children}</div>}
  </header>;
}

export function PageBackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="page-back"><span className="page-back__icon"><AppIcon name="chevron" size={18}/></span>{children}</Link>;
}

import Link from '@/lib/AppLink';
