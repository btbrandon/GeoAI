import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle DuckDB on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    // Exclude problematic files from webpack
    config.module.rules.push({
      test: /\.html$/,
      loader: "ignore-loader",
    });

    // Handle native modules
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        duckdb: "commonjs duckdb",
      });
    }

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ["duckdb"],
  },
};

export default nextConfig;
