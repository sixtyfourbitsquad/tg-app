import { Storage } from "@google-cloud/storage";
import path from "path";
import { logger } from "./logger";

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE
    ? path.join(process.cwd(), process.env.GCP_KEY_FILE)
    : undefined,
});

const BUCKET_NAME = process.env.GCP_BUCKET ?? "";

export function getBucket() {
  return storage.bucket(BUCKET_NAME);
}

/**
 * Upload a local file to GCS.
 * Returns the public GCS URL on success.
 */
export async function uploadFile(
  localPath: string,
  destination: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();

  await bucket.upload(localPath, {
    destination,
    metadata: { contentType },
    resumable: false,
  });

  logger.info("GCS upload complete", { destination });
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
}

/**
 * Upload a Buffer directly to GCS.
 * Returns the public GCS URL on success.
 */
export async function uploadBuffer(
  buffer: Buffer,
  destination: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(destination);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  logger.info("GCS buffer upload complete", { destination });
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
}

/**
 * Generate a signed URL valid for `expiresInMinutes` (default 60).
 */
export async function getSignedUrl(
  destination: string,
  expiresInMinutes = 60
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(destination);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  return url;
}

/**
 * Delete a file from GCS.
 */
export async function deleteFile(destination: string): Promise<void> {
  const bucket = getBucket();
  await bucket.file(destination).delete({ ignoreNotFound: true });
  logger.info("GCS file deleted", { destination });
}

/**
 * Check if a file exists in GCS.
 */
export async function fileExists(destination: string): Promise<boolean> {
  const bucket = getBucket();
  const [exists] = await bucket.file(destination).exists();
  return exists;
}
