import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type StorageProvider = 'LOCAL' | 'R2';

export interface StoreObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredObject {
  key: string;
  provider: StorageProvider;
}

function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function getR2Client(): S3Client {
  return new S3Client({
    region: process.env.R2_REGION ?? 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

async function storeLocalObject(input: StoreObjectInput): Promise<StoredObject> {
  const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads');
  const destination = path.join(uploadRoot, input.key);
  const normalizedRoot = path.resolve(uploadRoot);
  const normalizedDestination = path.resolve(destination);

  if (!normalizedDestination.startsWith(normalizedRoot)) {
    throw new Error('Invalid storage key');
  }

  await mkdir(path.dirname(normalizedDestination), { recursive: true });
  await writeFile(normalizedDestination, input.body, { flag: 'wx' });

  return {
    key: input.key,
    provider: 'LOCAL',
  };
}

async function storeR2Object(input: StoreObjectInput): Promise<StoredObject> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    })
  );

  return {
    key: input.key,
    provider: 'R2',
  };
}

export async function storeObject(input: StoreObjectInput): Promise<StoredObject> {
  if (hasR2Config()) {
    return storeR2Object(input);
  }

  return storeLocalObject(input);
}
