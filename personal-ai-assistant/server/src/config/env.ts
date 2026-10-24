function readString(name: string): string {
  const value = process.env[name];
  return value ?? "";
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  databaseUrl: readString("NEON_DATABASE_URL"),
  directUrl: readString("NEON_DIRECT_URL"),
  nimApiKey: readString("NVIDIA_NIM_API_KEY"),
  nimBaseUrl: process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
  neonAuthBaseUrl: readString("NEON_AUTH_BASE_URL"),
};

export const isDbConfigured = env.databaseUrl.length > 0;
export const isNimConfigured = env.nimApiKey.length > 0;
export const isNeonAuthConfigured = env.neonAuthBaseUrl.length > 0;
