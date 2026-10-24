"use client";

import NextLink from 'next/link';
import { forwardRef, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { prepareNavigationScroll } from './navigationScroll';
import { consumeSettingsBack, leaveSettingsNavigation, navigateSettings, rememberSettingsPush, requestSettingsNavigation } from './settingsNavigation';

// Keep viewport-wide speculation disabled: WebKit can abort it during document
// navigation, and lesson lists contain hundreds of links. RoutePreparation
// budgets only the five main destinations after the first visible paint.
const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(
  (props, ref) => {
    const router = useRouter();
    const href = typeof props.href === 'string' ? props.href : props.href.pathname ?? '';
    const pathway = /^\/learn(?:\/[^/]+)?\/?$/.test(href);
    return <NextLink {...props} scroll={props.scroll ?? !pathway} ref={ref} prefetch={false} onClick={event => {
    props.onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
    let restoringSettingsHistory = false;
    if (/^\/settings(?:\/|$)/.test(href)) {
      event.preventDefault();
      const destination = new URL(href, window.location.href).pathname.replace(/\/$/, '');
      const source = window.location.pathname.replace(/\/$/, '');
      if (destination === source) return;
      const direction = props['data-settings-direction'] === 'back'
        || (destination === '/settings' && source.startsWith('/settings/')) ? 'back' : 'forward';
      if (requestSettingsNavigation(href, direction)) return;
      if (direction === 'back') {
        const canReturn = consumeSettingsBack(href);
        restoringSettingsHistory = canReturn;
        navigateSettings(() => canReturn ? router.back() : router.replace(href));
      } else {
        rememberSettingsPush(href);
        navigateSettings(() => router.push(href, { scroll: props.scroll ?? !pathway }));
      }
    } else if (href && !/^\/settings(?:\/|$)/.test(href)) leaveSettingsNavigation();
    if (!restoringSettingsHistory && !pathway && props.scroll !== false && href) prepareNavigationScroll(href);
  }} />;},
);
AppLink.displayName = 'AppLink';
export default AppLink;
