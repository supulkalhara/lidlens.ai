/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable HTTP keep-alive for upstream fetches (faster API calls)
    httpAgentOptions: { keepAlive: true },
}

module.exports = nextConfig
