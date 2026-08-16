import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 添削1件のリクエストは数分かかることがあるため、
  // ボディサイズ上限を画像アップロード向けに引き上げる
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
