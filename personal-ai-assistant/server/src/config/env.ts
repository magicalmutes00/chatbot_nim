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
  nimImageBaseUrl: process.env.NVIDIA_NIM_IMAGE_BASE_URL ?? "https://ai.api.nvidia.com/v1/genai",
  firebaseProjectId: readString("FIREBASE_PROJECT_ID"),
  s3Endpoint: readString("S3_ENDPOINT"),
  s3Region: process.env.S3_REGION ?? "us-east-2",
  s3AccessKeyId: readString("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: readString("S3_SECRET_ACCESS_KEY"),
  s3Bucket: readString("S3_BUCKET"),
};

export const isDbConfigured = env.databaseUrl.length > 0;
export const isNimConfigured = env.nimApiKey.length > 0;
export const isFirebaseAuthConfigured = env.firebaseProjectId.length > 0;
export const isS3Configured = env.s3Endpoint.length > 0 && env.s3Bucket.length > 0;

