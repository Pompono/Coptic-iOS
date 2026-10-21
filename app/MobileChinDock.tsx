"use client";

import AppIcon from "./AppIcon";
import Link from "@/lib/AppLink";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type DockItem = {
  id: string;
  label: string;
  href?: string;
  placeholder?: boolean;
  icon: ReactNode;
  iconClassName?: string;
};

const DOCK_ITEMS: DockItem[] = [
 {id:'dictionary',label:'Dictionary',href:'/dictionary',icon:<AppIcon name="book" size={28}/>},
 {id:'learn',label:'Learn',href:'/learn',icon:<AppIcon name="learn" size={28}/>},
 {id:'home',label:'Home',href:'/',icon:<AppIcon name="home" size={28}/>},
 {id:'translator',label:'Translator',href:'/translator',icon:<AppIcon name="translate" size={28}/>},
 {id:'settings',label:'Settings',href:'/settings',icon:<AppIcon name="settings" size={28}/>},
];

function isItemActive(pathname: string, item: DockItem) {
  if (item.href === "/") {
    return pathname === "/" || pathname === "/read" || pathname === "/vocabulary";
  }

  if (!item.href) {
    return false;
  }

  if (item.href === '/settings' && pathname === '/account') return true;

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function shouldHideDock(pathname: string) {
  return /^\/learn\/[^/]+\/play\/[^/]+$/.test(pathname);
}

export default function MobileChinDock() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let restingHeight = window.innerHeight;
    const update = () => {
      const active = document.activeElement;
      const editing = active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && !["checkbox", "radio", "button"].includes(active.type));
      if (!editing) restingHeight = window.innerHeight;
      setKeyboardOpen(editing && Math.max(restingHeight, window.innerHeight) - viewport.height > 120 && viewport.scale <= 1.05);
    };
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  if (shouldHideDock(pathname) || keyboardOpen) {
    return null;
  }

  return (
    <nav className="mobile-chin-dock" aria-label="Mobile navigation">
      <div className="mobile-chin-dock__rail">
        {DOCK_ITEMS.map((item) => {
          const active = isItemActive(pathname, item);
          const className = [
            "mobile-chin-dock__item",
            active ? "is-active" : "",
            item.placeholder ? "is-placeholder" : "",
          ]
            .filter(Boolean)
            .join(" ");

          if (item.placeholder) {
            return (
              <button
                key={item.id}
                type="button"
                className={className}
                aria-label={`${item.label} coming soon`}
                disabled
              >
                <span className={["mobile-chin-dock__icon", item.iconClassName].filter(Boolean).join(" ")}>
                  {item.icon}
                </span>
              </button>
            );
          }

          return (
            <Link key={item.id} href={item.href ?? "/"} className={className} aria-label={item.label} aria-current={active ? "page" : undefined}>
              <span className={["mobile-chin-dock__icon", item.iconClassName].filter(Boolean).join(" ")}>
                {item.icon}
              </span>
              <span className="mobile-tab-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
