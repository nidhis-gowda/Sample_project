import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig, ID_DEMO_PROVIDER } from "@/auth.config";
import { connectDB } from "@/lib/db/connect";
import { nextEmployeeId } from "@/lib/db/sequence";
import { EmployeeModel } from "@/models/Employee";
import { UserModel, type UserDoc } from "@/models/User";

/**
 * Full Auth.js instance (Node.js runtime).
 *
 * `auth.config.ts` holds the edge-safe part, this module adds the MongoDB
 * backing: user provisioning on first login, calendar token storage and a
 * periodic role re-sync so an ADMIN role change takes effect without forcing
 * the user to sign out.
 */

/** True when the development-only, password-less demo login is enabled. */
export const devCredentialsEnabled = process.env.ENABLE_DEV_CREDENTIALS === "true";

/** How often the JWT is re-synchronised with MongoDB (ms). */
const ROLE_SYNC_INTERVAL_MS = 120_000;

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Development-only password-less provider.
 *
 * It never accepts or stores a password: it simply resolves an *existing*
 * MongoDB user by email. Always disabled unless ENABLE_DEV_CREDENTIALS=true,
 * which is documented as "never enable in production".
 */
const devCredentials = Credentials({
  id: ID_DEMO_PROVIDER,
  name: "Demo account",
  credentials: {
    email: {
      label: "Work email of a seeded demo user",
      type: "email",
      placeholder: "alex.morgan@skillalloc.dev",
    },
  },
  async authorize(credentials) {
    if (process.env.ENABLE_DEV_CREDENTIALS !== "true") return null;

    const email =
      typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
    if (!email) return null;

    await connectDB();
    const user = await UserModel.findOne({ email }).lean();
    if (!user || !user.isActive) return null;

    const employee = await EmployeeModel.findOne({ userId: user._id })
      .select("_id")
      .lean<{ _id: unknown } | null>();

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role: user.role,
      employeeId: employee ? String(employee._id) : null,
    };
  },
});

async function enrichToken(
  token: Record<string, unknown>,
  userDoc: Pick<UserDoc, "_id" | "name" | "email" | "image" | "role">
): Promise<void> {
  token.uid = String(userDoc._id);
  token.role = userDoc.role;
  token.name = userDoc.name;
  token.email = userDoc.email;
  token.picture = userDoc.image ?? token.picture ?? null;
  const employee = await EmployeeModel.findOne({ userId: userDoc._id })
    .select("_id")
    .lean<{ _id: unknown } | null>();
  token.employeeId = employee ? String(employee._id) : null;
  token.roleSyncedAt = Date.now();
}

/**
 * Resolves the *effective* provider id exactly like Auth.js `parseProviders`.
 *
 * The `Credentials()` factory ignores a custom `id` at the top level: it always
 * returns `id: "credentials"` and stores the caller's config (including its own
 * `id`) under `options`. `parseProviders` therefore computes
 * `options.id ?? id`. Reading `.id` alone would make a deny-all placeholder and
 * the real provider look like two different providers while they actually
 * collide on the same id, and the placeholder would shadow the real one.
 */
function effectiveProviderId(provider: unknown): string | undefined {
  const candidate = provider as { id?: string; options?: { id?: string } } | undefined;
  return candidate?.options?.id ?? candidate?.id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Drop the edge-safe placeholder and install the database backed provider.
    ...(authConfig.providers ?? []).filter(
      (provider) => effectiveProviderId(provider) !== ID_DEMO_PROVIDER
    ),
    devCredentials,
  ],
  callbacks: {
    ...authConfig.callbacks,

    /* ---------------- Provision / verify the user ---------------- */
    async signIn({ user, account }) {
      if (!user?.email) return false;

      try {
        await connectDB();
      } catch (error) {
        console.error("[auth] MongoDB is unavailable during sign-in:", error);
        return false;
      }

      const email = user.email.trim().toLowerCase();
      const now = new Date();
      const isAdminEmail = adminEmails().includes(email);
      let dbUser = await UserModel.findOne({ email });

      if (!dbUser) {
        try {
          dbUser = await UserModel.create({
            name: user.name ?? email.split("@")[0],
            email,
            image: user.image ?? null,
            // New accounts default to EMPLOYEE unless the email is configured
            // as an administrator through ADMIN_EMAILS.
            role: isAdminEmail ? "ADMIN" : "EMPLOYEE",
            googleId: account?.provider === "google" ? account.providerAccountId : null,
            isActive: true,
            lastLoginAt: now,
          });
        } catch {
          // Race condition: a concurrent request already created the account.
          dbUser = await UserModel.findOne({ email });
          if (!dbUser) return false;
        }

        // Every account gets an editable employee profile so that the EMPLOYEE
        // role has data to manage from the very first login.
        try {
          await EmployeeModel.create({
            userId: dbUser._id,
            employeeId: await nextEmployeeId(),
            name: dbUser.name,
            email: dbUser.email,
            avatar: dbUser.image ?? null,
            jobRole:
              dbUser.role === "PROJECT_MANAGER" ? "PROJECT_MANAGER" : "BACKEND_DEVELOPER",
            status: "ACTIVE",
            yearsOfExperience: 0,
            location: "Remote",
            availabilityPercent: 100,
            skills: [],
            certifications: [],
          });
        } catch (error) {
          console.warn("[auth] could not create the employee profile:", error);
        }
      } else {
        if (!dbUser.isActive) return false;
        dbUser.lastLoginAt = now;
        if (user.name) dbUser.name = user.name;
        if (user.image) dbUser.image = user.image;
        if (account?.provider === "google") {
          dbUser.googleId = account.providerAccountId;
        }
        if (isAdminEmail && dbUser.role !== "ADMIN") {
          dbUser.role = "ADMIN";
        }
        await dbUser.save();
      }

      /* ---------------- Google Calendar token storage ---------------- */
      if (account?.provider === "google") {
        const update: Record<string, unknown> = {};
        if (account.access_token) {
          update.googleAccessToken = account.access_token;
          update.googleTokenExpiry = account.expires_at
            ? new Date(account.expires_at * 1000)
            : null;
        }
        if (account.refresh_token) {
          update.googleRefreshToken = account.refresh_token;
          update.calendarConnected = true;
        }
        if (Object.keys(update).length > 0) {
          await UserModel.updateOne({ _id: dbUser._id }, { $set: update });
        }
      }

      return true;
    },

    /* ---------------- JWT: source of truth for role ---------------- */
    async jwt({ token, user }) {
      try {
        if (user?.email) {
          await connectDB();
          const dbUser = await UserModel.findOne({
            email: user.email.trim().toLowerCase(),
          }).lean();
          if (dbUser) await enrichToken(token, dbUser);
          return token;
        }

        const lastSynced = typeof token.roleSyncedAt === "number" ? token.roleSyncedAt : 0;
        if (token.uid && Date.now() - lastSynced > ROLE_SYNC_INTERVAL_MS) {
          await connectDB();
          const dbUser = await UserModel.findById(token.uid).lean();
          if (dbUser) {
            await enrichToken(token, dbUser);
          } else {
            token.roleSyncedAt = Date.now();
          }
        }
      } catch (error) {
        // Never break authentication because of a transient DB hiccup — the
        // existing token keeps working and is re-synced on the next request.
        console.warn("[auth] token synchronisation skipped:", error);
      }
      return token;
    },
  },
});