import multer from 'multer';
import path from 'node:path';

import { badRequest } from '../lib/errors.js';

const maxUploadBytes = Number.parseInt(process.env.BIN_UPLOAD_MAX_SIZE ?? '52428800', 10);
const allowedMimeTypes = new Set([
  'application/octet-stream',
  'application/macbinary',
  'application/x-binary',
  'application/x-msdownload',
]);

export const binUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
    files: 1,
    fields: 8,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeTypeAllowed = allowedMimeTypes.has(file.mimetype) || file.mimetype === '';

    if (extension !== '.bin') {
      cb(badRequest('Only .bin files are accepted.'));
      return;
    }

    if (!mimeTypeAllowed) {
      cb(badRequest('Unsupported file type for BIN upload.'));
      return;
    }

    cb(null, true);
  },
});

export function getMaxUploadBytes(): number {
  return maxUploadBytes;
}
