import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

const jobsActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("requeue"), jobId: z.string() }),
  z.object({ action: z.literal("cancel"), jobId: z.string() }),
  z.object({ action: z.literal("update-cost-limit"), costLimit: z.number().nonnegative() }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = jobsActionSchema.parse(await request.json());
    const timestamp = nowIso();
    let payload = {};

    await updateDb((db) => {
      if (input.action === "requeue") {
        db.generationJobs = db.generationJobs.map((job) =>
          job.projectId === projectId && job.id === input.jobId && job.status === "failed"
            ? {
                ...job,
                status: "queued",
                retryCount: job.retryCount + 1,
                errorMessage: undefined,
                startedAt: undefined,
                completedAt: undefined,
              }
            : job,
        );
        payload = { jobId: input.jobId };
      }

      if (input.action === "cancel") {
        db.generationJobs = db.generationJobs.map((job) =>
          job.projectId === projectId && job.id === input.jobId && (job.status === "pending" || job.status === "queued")
            ? { ...job, status: "cancelled", completedAt: timestamp }
            : job,
        );
        payload = { jobId: input.jobId };
      }

      if (input.action === "update-cost-limit") {
        db.projects = db.projects.map((project) =>
          project.id === projectId ? { ...project, costLimit: input.costLimit, updatedAt: timestamp } : project,
        );
        payload = { costLimit: input.costLimit };
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
