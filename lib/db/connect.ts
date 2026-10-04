import mongoose, { type Mongoose } from "mongoose";

/**
 * Cached MongoDB connection.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise create a new
 * connection on every reload and exhaust the Atlas connection pool. The
 * connection promise is therefore stored on the Node.js global object.
 *
 * `strictQuery` is enabled so that unknown query fields are stripped instead of
 * being passed straight through to MongoDB (a mild protection against query
 * injection through object payloads).
 *
 * `sanitizeFilter` is deliberately NOT enabled. It wraps *every* object value
 * in `$eq`, which silently rewrites the operator filters this application
 * relies on (`{ $in: [...] }`, `{ $nin: [...] }`) into
 * `{ $eq: { $in: [...] } }` and makes them fail schema casting with a
 * CastError. It also protects nothing here: no filter in this codebase is ever
 * built from an unvalidated client object. Injection safety comes from the
 * layers that actually receive client input — Zod schemas strip unknown keys,
 * identifiers are validated as ObjectId hex, search terms are escaped before
 * becoming a RegExp, and sort keys come from a whitelist (`resolveSort`).
 */

/**
 * Read lazily rather than at module load: ES module imports are hoisted above
 * any `.env.local` loading performed by a script, so a top-level constant can
 * capture an empty value.
 */
function mongoUri(): string | undefined {
  return process.env.MONGODB_URI;
}

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache =
  global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

mongoose.set("strictQuery", true);

export function isDatabaseConfigured(): boolean {
  const uri = mongoUri();
  return Boolean(uri && uri.trim().length > 0);
}

export async function connectDB(): Promise<Mongoose> {
  const uri = mongoUri();
  if (!uri || !uri.trim()) {
    throw new Error(
      "MONGODB_URI is not configured. Copy .env.example to .env.local and set MONGODB_URI."
    );
  }

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

/** Utility used by scripts (seed) and tests. */
export async function disconnectDB(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}