/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['exceljs'],
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
};
export default nextConfig;
