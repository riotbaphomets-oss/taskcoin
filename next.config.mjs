/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    // Nötig, wenn die App hinter dem Proxy von GitHub Codespaces läuft.
    serverActions: { allowedOrigins: ["*.app.github.dev"] },
  },
};
export default nextConfig;
