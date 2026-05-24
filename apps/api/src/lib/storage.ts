import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
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

export interface ReadObjectInput {
  key: string;
  provider?: StorageProvider;
}

export interface ReadObjectResult {
  key: string;
  provider: StorageProvider;
  body: Buffer;
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

function resolveLocalObjectPath(key: string): string {
  const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads');
  const destination = path.join(uploadRoot, key);
  const normalizedRoot = path.resolve(uploadRoot);
  const normalizedDestination = path.resolve(destination);

  if (!normalizedDestination.startsWith(normalizedRoot)) {
    throw new Error('Invalid storage key');
  }

  return normalizedDestination;
}

async function readLocalObject(input: ReadObjectInput): Promise<ReadObjectResult> {
  return {
    key: input.key,
    provider: 'LOCAL',
    body: await readFile(resolveLocalObjectPath(input.key)),
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

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks);
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  throw new Error('Unsupported object body stream.');
}

async function readR2Object(input: ReadObjectInput): Promise<ReadObjectResult> {
  const client = getR2Client();
  const object = await client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: input.key,
    })
  );

  return {
    key: input.key,
    provider: 'R2',
    body: await streamToBuffer(object.Body),
  };
}

export async function storeObject(input: StoreObjectInput): Promise<StoredObject> {
  if (hasR2Config()) {
    return storeR2Object(input);
  }

  return storeLocalObject(input);
}

export async function readObject(input: ReadObjectInput): Promise<ReadObjectResult> {
  if (input.provider === 'R2' || (!input.provider && hasR2Config())) {
    return readR2Object(input);
  }

  return readLocalObject(input);
}
