import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const isProduction = nodeEnv === 'production';
const mongoUri = process.env.NTE_MONGODB_URI?.trim() ?? '';
const mongoDatabase = process.env.NTE_MONGODB_DATABASE?.trim() ?? '';
const jwtSecret = process.env.NTE_JWT_SECRET?.trim() ?? '';
const configuredPort = Number(process.env.NTE_PORT || process.env.PORT || '3100');
if (!Number.isSafeInteger(configuredPort) || configuredPort < 1 || configuredPort > 65_535) {
  throw new Error('NTE_PORT or PORT must be a valid TCP port.');
}

function assertDatabaseIsolation(): void {
  if (!mongoUri) throw new Error('NTE_MONGODB_URI is required.');
  if (mongoDatabase !== 'nte_naadu') {
    throw new Error('NTE_MONGODB_DATABASE must be exactly nte_naadu.');
  }
  let parsed: URL;
  try { parsed = new URL(mongoUri); } catch { throw new Error('NTE_MONGODB_URI is invalid.'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error('NTE_MONGODB_URI must use mongodb:// or mongodb+srv://.');
  }
  if (parsed.hostname.toLowerCase().includes('happinotes') || parsed.pathname.toLowerCase().includes('happinotes')) {
    throw new Error('HappiNotes database hosts and names are not permitted.');
  }
  const uriDatabase = parsed.pathname.replace(/^\//, '').split('/')[0];
  if (uriDatabase && uriDatabase.toLowerCase() !== 'nte_naadu') {
    throw new Error('NTE_MONGODB_URI must name the nte_naadu database.');
  }
}

function assertSecret(): void {
  if (jwtSecret.length < 32 || /replace|change[-_ ]?me|placeholder|example/i.test(jwtSecret)) {
    throw new Error('NTE_JWT_SECRET must be a unique random secret of at least 32 characters.');
  }
  if (new Set(jwtSecret).size < 12) throw new Error('NTE_JWT_SECRET must contain at least 12 distinct characters.');
}

function canonicalOrigins(): string[] {
  const raw = process.env.NTE_CORS_ORIGINS?.trim() ?? '';
  // An empty production allowlist intentionally disables browser cross-origin
  // access. Native mobile clients do not send a browser Origin header. Add
  // exact HTTPS origins only when an NTE browser client is provisioned.
  if (isProduction && !raw) return [];
  const entries = raw ? raw.split(',').map((item) => item.trim()) : [
    'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173',
  ];
  for (const origin of entries) {
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new Error('NTE_CORS_ORIGINS contains an invalid origin.'); }
    if (parsed.origin !== origin || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('NTE_CORS_ORIGINS must contain canonical origins only.');
    }
    if (isProduction && parsed.protocol !== 'https:') throw new Error('Production NTE CORS origins must use HTTPS.');
    if (origin.toLowerCase().includes('happinotes')) throw new Error('HappiNotes browser origins are not permitted.');
  }
  return [...new Set(entries)];
}

const verificationProvider = process.env.NTE_VERIFICATION_PROVIDER?.trim() || 'disabled';
const recoveryProvider = process.env.NTE_RECOVERY_PROVIDER?.trim() || 'disabled';
const mediaProvider = process.env.NTE_MEDIA_PROVIDER?.trim() || 'disabled';
const adultVerificationProvider = process.env.NTE_ADULT_VERIFICATION_PROVIDER?.trim() || 'disabled';
const paymentProvider = process.env.NTE_PAYMENT_PROVIDER?.trim() || 'disabled';
if (verificationProvider !== 'disabled') {
  throw new Error('The configured NTE verification provider has no implementation in this phase.');
}
if (recoveryProvider !== 'disabled') {
  throw new Error('The configured NTE recovery provider has no implementation in this phase.');
}
if (mediaProvider !== 'disabled') {
  throw new Error('The configured NTE media provider has no implementation in this phase.');
}
if (adultVerificationProvider !== 'disabled') {
  throw new Error('The configured NTE adult verification provider has no implementation in this phase.');
}
if (paymentProvider !== 'disabled') {
  throw new Error('The configured NTE payment provider has no reviewed adapter in this phase.');
}

assertDatabaseIsolation();
assertSecret();

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: configuredPort,
  mongoUri,
  mongoDatabase,
  jwtSecret,
  corsOrigins: canonicalOrigins(),
  verificationProvider,
  recoveryProvider,
  mediaProvider,
  adultVerificationProvider,
  paymentProvider,
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlDays: 30,
});
