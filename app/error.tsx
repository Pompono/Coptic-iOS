'use client';

export default function RouteError({ reset }: { reset: () => void }) {
  return <main className="app-page">
    <h1>This page could not open</h1>
    <p role="alert">A required app resource could not load. Please try again.</p>
    <button className="ui-primary" onClick={reset}>Try again</button>
    {/* A full document reload recovers a failed client chunk/router cache. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a className="ui-secondary" href="/">Return home</a>
  </main>;
}
