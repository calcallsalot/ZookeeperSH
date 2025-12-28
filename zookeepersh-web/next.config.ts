import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "zookeepersh.io",
    "*.zookeepersh.io",
    "localhost:3000",
  ]
};

export default nextConfig;
