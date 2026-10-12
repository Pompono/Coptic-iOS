"use client";

import NextLink from 'next/link';
import { forwardRef, type ComponentProps } from 'react';

// All pages are bundled locally. Speculative fetches add work and can be
// aborted by WebKit during document navigation; fetch pages when requested.
const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(
  (props, ref) => <NextLink {...props} ref={ref} prefetch={false} />,
);
AppLink.displayName = 'AppLink';
export default AppLink;
