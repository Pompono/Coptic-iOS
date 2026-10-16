"use client";

import NextLink from 'next/link';
import { forwardRef, type ComponentProps } from 'react';
import { prepareNavigationScroll } from './navigationScroll';

// All pages are bundled locally. Speculative fetches add work and can be
// aborted by WebKit during document navigation; fetch pages when requested.
const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(
  (props, ref) => {
    const href = typeof props.href === 'string' ? props.href : props.href.pathname ?? '';
    const pathway = /^\/learn(?:\/[^/]+)?\/?$/.test(href);
    return <NextLink {...props} scroll={props.scroll ?? !pathway} ref={ref} prefetch={false} onClick={event => {
    props.onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
    const href = typeof props.href === 'string' ? props.href : props.href.pathname;
    if (!pathway && props.scroll !== false && href) prepareNavigationScroll(href);
  }} />;},
);
AppLink.displayName = 'AppLink';
export default AppLink;
