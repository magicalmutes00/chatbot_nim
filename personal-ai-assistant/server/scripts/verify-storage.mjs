// One-shot connectivity test for the S3-compatible storage endpoint.
// Run: node scripts/verify-storage.mjs
import "dotenv/config";
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-2",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
  forcePathStyle: true,
});

try {
  // 1. discover buckets
  let bucket;
  try {
    const listed = await client.send(new ListBucketsCommand({}));
    bucket = listed.Buckets?.[0]?.Name;
    console.log("ListBuckets ok:", listed.Buckets?.map((b) => b.Name).join(", ") || "(empty)");
  } catch (err) {
    console.log("ListBuckets failed:", err.message);
  }

  // 2. ensure a bucket
  if (!bucket) {
    bucket = "aurora";
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log("CreateBucket ok:", bucket);
    } catch (err) {
      if (err.name === "BucketAlreadyOwnedByYou" || err.name === "BucketAlreadyExists") {
        console.log("Bucket already exists:", bucket);
      } else {
        console.log("CreateBucket failed:", err.message, "(name:", err.name + ")");
      }
    }
  }

  // 3. round-trip an object
  const key = `__connectivity-test-${Date.now()}.txt`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "aurora storage ok" }));
  console.log("PutObject ok");

  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await got.Body.transformToString("utf-8");
  console.log("GetObject ok:", JSON.stringify(body));

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("DeleteObject ok");

  console.log(`\nRESULT: storage fully functional — use bucket "${bucket}"`);
  process.exit(0);
} catch (err) {
  console.error("FAILED:", err.message);
  process.exit(1);
}
