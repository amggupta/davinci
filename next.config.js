/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NEXT_PUBLIC_OPENAI_ASSISTANT_ID: process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID,
    NEXT_PUBLIC_SVG_ASSISTANT_ID: process.env.NEXT_PUBLIC_SVG_ASSISTANT_ID,
  },
  images: {
    domains: ['localhost', 'your-production-domain.com'], // Add any domains you need for next/image
  },
}

module.exports = nextConfig 