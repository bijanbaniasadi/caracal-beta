#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.argv[2] ?? '.env.production');
const fileEnv = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };

const required = [
  'NODE_ENV',
  'PUBLIC_SITE_URL',
  'NEXT_PUBLIC_API_URL',
  'DATABASE_URL',
  'REDIS_URL',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CORS_ORIGINS',
];

const errors = [];
const warnings = [];

for (const key of required) {
  if (!env[key] || String(env[key]).trim() === '') {
    errors.push(`${key} is required`);
  }
}

if (env.NODE_ENV !== 'production') {
  errors.push('NODE_ENV must be production');
}

expectUrl('PUBLIC_SITE_URL');
expectUrl('NEXT_PUBLIC_API_URL');
expectUrl('REDIS_URL', ['redis:', 'rediss:']);

if (env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
  errors.push('DATABASE_URL must be a PostgreSQL connection string');
}

for (const key of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET']) {
  if (env[key] && env[key].length < 32) {
    errors.push(`${key} must be at least 32 characters`);
  }
}

if (env.STRIPE_SECRET_KEY && !/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY)) {
  errors.push('STRIPE_SECRET_KEY must start with sk_test_ or sk_live_');
}

if (env.STRIPE_WEBHOOK_SECRET && !/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET)) {
  errors.push('STRIPE_WEBHOOK_SECRET must start with whsec_');
}

if (env.AUTH_COOKIE_SECURE !== undefined && env.AUTH_COOKIE_SECURE !== 'true') {
  warnings.push('AUTH_COOKIE_SECURE should be true in production');
}

if (env.PUBLIC_SITE_URL?.includes('localhost') || env.CORS_ORIGINS?.includes('localhost')) {
  warnings.push('localhost appears in production URL/CORS settings');
}

if (env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  warnings.push('STRIPE_SECRET_KEY is a test key; use sk_live_ for live launch');
}

if (errors.length > 0) {
  console.error('Production environment validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length > 0) {
    console.error('\nWarnings:');
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log(`Production environment validation passed for ${envPath}`);
if (warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

function parseEnvFile(source) {
  const parsed = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function expectUrl(key, protocols = ['http:', 'https:']) {
  if (!env[key]) return;
  try {
    const parsed = new URL(env[key]);
    if (!protocols.includes(parsed.protocol)) {
      errors.push(`${key} must use one of: ${protocols.join(', ')}`);
    }
  } catch {
    errors.push(`${key} must be a valid URL`);
  }
}
