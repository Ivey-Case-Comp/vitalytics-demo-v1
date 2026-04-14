import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In production on Vercel, /api/* is routed to the FastAPI backend via
  // experimentalServices in vercel.json — no rewrite needed.
  // In local dev, proxy /api/* to the FastAPI server on port 8000.
  ...(process.env.NODE_ENV === "development" && {
    async rewrites() {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
    },
  }),
};

export default nextConfig;
