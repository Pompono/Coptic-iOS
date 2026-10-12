"use client";

import Link from "@/lib/AppLink";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type DockItem = {
  id: string;
  label: string;
  href?: string;
  placeholder?: boolean;
  icon: ReactNode;
  iconClassName?: string;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.2 3.5 9.9a1 1 0 0 0 .62 1.8H5v7.1c0 1.1.9 2 2 2h3.9v-5.2h2.2v5.2H17c1.1 0 2-.9 2-2v-7.1h.88a1 1 0 0 0 .62-1.8L12 3.2Z"
      />
    </svg>
  );
}

function DictionaryPlaceholderIcon() {
  return (
    <span
      aria-hidden="true"
      className="mobile-chin-dock__mask-shape mobile-chin-dock__mask-shape--dictionary"
    />
  );
}

function PlaceholderTwoIcon() {
  return (
    <span
      aria-hidden="true"
      className="mobile-chin-dock__mask-shape mobile-chin-dock__mask-shape--learn"
    />
  );
}

function TranslatePlaceholderIcon() {
  return (
    <span
      aria-hidden="true"
      className="mobile-chin-dock__mask-shape mobile-chin-dock__mask-shape--translate"
    />
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 23.48 23.48" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.008 23.247h-2.434c-.464 0-.598 0-1.862-3.128l-.843-.343c-2.598 1.179-2.91 1.179-3.044 1.179-.172 0-.365-.075-.486-.196l-1.721-1.685c-.343-.338-.431-.425.934-3.521l-.34-.803C0 13.601 0 13.462 0 12.981v-2.385c0-.477 0-.599 3.201-1.838l.34-.805C2.1 4.916 2.199 4.818 2.545 4.477l1.724-1.685c.121-.118.314-.193.484-.193.125 0 .45 0 3.092 1.115l.838-.341C9.858.232 10.007.232 10.472.232h2.434c.463 0 .598 0 1.861 3.13l.842.34c2.596-1.176 2.908-1.176 3.044-1.176.171 0 .363.074.484.192l1.725 1.683c.336.331.431.425-.934 3.523l.339.808c3.213 1.147 3.213 1.285 3.213 1.764v2.384c0 .478-.001.601-3.203 1.841l-.338.805c1.442 3.035 1.342 3.134.999 3.475l-1.728 1.688c-.122.119-.314.193-.484.193 0 0-.123 0-3.088-1.117l-.842.341c-1.189 3.129-1.326 3.129-1.802 3.129Zm-2.084-1.302h1.725c.23-.492.673-1.604 1.029-2.562a.652.652 0 0 1 .365-.376l1.357-.55a.662.662 0 0 1 .499.005c.976.415 2.129.879 2.651 1.055l1.208-1.184c-.194-.512-.684-1.596-1.119-2.509a.665.665 0 0 1-.013-.533l.559-1.328a.65.65 0 0 1 .366-.354c.983-.38 2.127-.849 2.628-1.087v-1.656c-.507-.226-1.642-.656-2.618-1.003a.651.651 0 0 1-.383-.361l-.559-1.33a.676.676 0 0 1 .005-.517c.418-.943.884-2.058 1.067-2.577l-1.209-1.181c-.518.187-1.641.671-2.589 1.104a.663.663 0 0 1-.514.011l-1.357-.548a.653.653 0 0 1-.36-.361c-.387-.963-.864-2.083-1.108-2.571H10.83c-.231.493-.673 1.605-1.028 2.562a.653.653 0 0 1-.365.377l-1.353.55a.663.663 0 0 1-.5-.004C6.608 4.602 5.451 4.138 4.93 3.965L3.722 5.147c.195.513.682 1.597 1.118 2.512a.667.667 0 0 1 .012.533L4.29 9.519a.65.65 0 0 1-.365.354C2.942 10.252 1.8 10.719 1.3 10.957v1.657c.505.228 1.641.659 2.618 1.007.171.062.311.193.381.36l.558 1.327a.663.663 0 0 1-.004.515c-.418.944-.884 2.059-1.067 2.577l1.208 1.182c.517-.188 1.64-.672 2.589-1.104a.664.664 0 0 1 .514-.012l1.357.551a.649.649 0 0 1 .359.36c.389.967.867 2.086 1.111 2.572Zm.816-6.075c-2.319 0-4.207-1.854-4.207-4.13 0-2.275 1.888-4.127 4.207-4.127 2.318 0 4.205 1.852 4.205 4.127 0 2.276-1.887 4.13-4.205 4.13Zm0-6.956c-1.602 0-2.905 1.268-2.905 2.826 0 1.561 1.303 2.829 2.905 2.829s2.904-1.269 2.904-2.829c0-1.559-1.302-2.826-2.904-2.826Z"
      />
    </svg>
  );
}

const DOCK_ITEMS: DockItem[] = [
  { id: "home", label: "Home", href: "/", icon: <HomeIcon /> },
  {
    id: "dictionary",
    label: "Dictionary",
    href: "/dictionary",
    icon: <DictionaryPlaceholderIcon />,
    iconClassName: "mobile-chin-dock__icon--dictionary",
  },
  {
    id: "learn",
    label: "Learn",
    href: "/learn",
    icon: <PlaceholderTwoIcon />,
    iconClassName: "mobile-chin-dock__icon--learn",
  },
  {
    id: "translator",
    label: "Translator",
    href: "/translator",
    icon: <TranslatePlaceholderIcon />,
    iconClassName: "mobile-chin-dock__icon--translate",
  },
  { id: "settings", label: "Settings", href: "/settings", icon: <SettingsIcon /> },
];

function isItemActive(pathname: string, item: DockItem) {
  if (item.href === "/") {
    return pathname === "/";
  }

  if (!item.href) {
    return false;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function shouldHideDock(pathname: string) {
  return /^\/learn\/[^/]+\/play\/[^/]+$/.test(pathname);
}

export default function MobileChinDock() {
  const pathname = usePathname().replace(/\/$/, "") || "/";

  if (shouldHideDock(pathname)) {
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
            <Link key={item.id} href={item.href ?? "/"} className={className} aria-label={item.label}>
              <span className={["mobile-chin-dock__icon", item.iconClassName].filter(Boolean).join(" ")}>
                {item.icon}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
