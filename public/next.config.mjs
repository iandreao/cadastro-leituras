/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
      // Ignora erros de TypeScript no build de produção
      ignoreBuildErrors: true,
    },
    eslint: {
      // Ignora avisos de lint no build de produção
      ignoreDuringBuilds: true,
    },
  };
  
  export default nextConfig;
  