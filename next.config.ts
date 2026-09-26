import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Anexos: até 5 arquivos de 10 MB por envio (+ folga do multipart).
    serverActions: { bodySizeLimit: "52mb" },
    proxyClientMaxBodySize: "52mb",
  },
};

export default nextConfig;
