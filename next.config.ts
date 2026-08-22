import type { NextConfig } from "next";

// GitHub Pages 배포용 정적 내보내기.
// BASE_PATH는 CI에서 "/templar"로 주입된다 (로컬 개발은 빈 값).
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
