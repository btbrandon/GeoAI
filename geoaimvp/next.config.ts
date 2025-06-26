import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    config.module.rules.push({
      test: /\.html$/,
      loader: "ignore-loader",
    });

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
