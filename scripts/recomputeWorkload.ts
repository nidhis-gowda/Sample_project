/**
 * Loads `.env.local` then `.env` (Next.js convention: `.env.local` wins).
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadEnv({ path });
}

import { connectDB, disconnectDB } from "@/lib/db/connect";
import { recomputeAllWorkloads } from "@/services/workloadService";
import { scanDeadlineNotifications } from "@/services/notificationService";

/**
 * Maintenance script.
 *
 * The workload snapshot in the `workloads` collection is refreshed automatically
 * whenever an allocation changes, but this script is useful after a bulk import,
 * a restore from backup, or a manual data fix.
 *
 * Run with:  npm run recompute-workload
 */

async function main(): Promise<void> {
  console.log("Connecting to MongoDB...");
  await connectDB();

  console.log("Recomputing workload snapshots from ACTIVE allocations...");
  const count = await recomputeAllWorkloads();
  console.log(`Recomputed workload for ${count} employee(s)`);

  console.log("Raising deadline notifications...");
  const notifications = await scanDeadlineNotifications();
  console.log(`Created ${notifications} deadline notification(s)`);

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("Recompute failed:", error);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});