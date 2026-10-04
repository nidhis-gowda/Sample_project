import { z } from "zod";
import { readBody } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { proficiencySchema } from "@/lib/validators/common";
import { recommendTrainingForGaps } from "@/services/trainingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gapSchema = z.object({
  skillId: z.string().trim().optional().nullable(),
  skillName: z.string().trim().min(1).max(80),
  currentProficiency: proficiencySchema,
  requiredProficiency: proficiencySchema,
  reason: z.string().trim().max(300).default("Skill level below requirement."),
});

const bodySchema = z.object({
  gaps: z.array(gapSchema).min(1, "Provide at least one skill gap").max(50),
});

/**
 * POST /api/training/recommendations
 * Maps a set of skill gaps onto the internal training catalogue. Used by the
 * Team Builder when a selected team still has uncovered requirements.
 */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "training:recommend", ...READ_LIMIT });
  await requirePermission("training:read");
  const body = await readBody(request, bodySchema);
  return ok(await recommendTrainingForGaps(body.gaps));
});