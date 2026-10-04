import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { TrainingCatalogue } from "@/components/training/TrainingCatalogue";

export const metadata: Metadata = { title: "Training" };
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const user = await requirePageUser("training:read");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Training</h1>
        <p className="section-subtitle">
          The internal course catalogue. Whenever a skill gap is detected, the engine
          recommends the smallest course that reaches the required level.
        </p>
      </header>

      <TrainingCatalogue isEmployee={user.role === "EMPLOYEE"} />
    </div>
  );
}