/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  // Keep metadata in the head for every WebView/browser. Streamed metadata
  // can otherwise land in the body during navigation and break hydration.
  htmlLimitedBots: /.*/,
};
