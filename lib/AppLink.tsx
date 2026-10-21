"use client";

import NextLink from 'next/link';
import { forwardRef, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { prepareNavigationScroll } from './navigationScroll';
import { consumeSettingsBack, navigateSettings, rememberSettingsPush } from './settingsNavigation';

// All pages are bundled locally. Speculative fetches add work and can be
// aborted by WebKit during document navigation; fetch pages when requested.
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
    if (/^\/settings(?:\/|$)/.test(href) && href !== window.location.pathname) {
      event.preventDefault();
      const direction = props['data-settings-direction'] === 'back' ? 'back' : 'forward';
      if (direction === 'back') {
        const canReturn = consumeSettingsBack(href);
        restoringSettingsHistory = canReturn;
        navigateSettings(() => canReturn ? router.back() : router.replace(href), direction, href);
      } else {
        rememberSettingsPush(href);
        navigateSettings(() => router.push(href, { scroll: props.scroll ?? !pathway }), direction, href);
      }
    }
    if (!restoringSettingsHistory && !pathway && props.scroll !== false && href) prepareNavigationScroll(href);
  }} />;},
);
AppLink.displayName = 'AppLink';
export default AppLink;
