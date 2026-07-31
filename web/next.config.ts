import type { NextConfig } from "next";

// NEXT_PUBLIC_* values are inlined at build time, so a missing socket URL
// produces a bundle that can never reach the game server. Surface it here
// rather than letting players discover it as an endless "Connecting…".
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SOCKET_URL) {
  console.warn(
    "\n[build] NEXT_PUBLIC_SOCKET_URL is not set.\n" +
      "        The client will fall back to the page origin, which only works if the\n" +
      "        Socket.IO server is proxied under the same domain.\n" +
      "        Set it to the public https URL of the realtime server.\n"
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tod/shared"],
  poweredByHeader: false,
  compiler: {
    // Keep warnings and errors for real diagnostics; drop the noise.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
