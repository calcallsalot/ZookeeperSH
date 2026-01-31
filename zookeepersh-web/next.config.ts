import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "zookeepersh.io:3000",
    "*.zookeepersh.io:3000",
    "localhost:3000",
  ]
};

export default nextConfig;
