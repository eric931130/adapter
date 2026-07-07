"use client";

import { create } from "zustand";

import { mockGenerationAdapter } from "@/adapters/ai-adapter";
import {
  assets as seedAssets,
  generationJobs as seedJobs,
  projects as seedProjects,
  shots as seedShots,
} from "@/lib/mock-data";
import type { Asset, GenerationJob, Project, Shot } from "@/lib/schemas";

type StudioState = {
  projects: Project[];
  shots: Shot[];
  assets: Asset[];
  generationJobs: GenerationJob[];
  staleWarnings: Record<string, string>;
  approveShot: (shotId: string) => void;
  markDownstreamStale: (projectId: string, reason: string) => void;
  enqueueImageJob: (shotId: string) => Promise<void>;
  enqueueVideoJob: (shotId: string) => Promise<void>;
};

export const useStudioStore = create<StudioState>((set, get) => ({
  projects: seedProjects,
  shots: seedShots,
  assets: seedAssets,
  generationJobs: seedJobs,
  staleWarnings: {},
  approveShot: (shotId) =>
    set((state) => ({
      shots: state.shots.map((shot) =>
        shot.id === shotId
          ? { ...shot, imageStatus: "approved", updatedAt: new Date().toISOString() }
          : shot,
      ),
    })),
  markDownstreamStale: (projectId, reason) =>
    set((state) => ({
      staleWarnings: {
        ...state.staleWarnings,
        [projectId]: reason,
      },
    })),
  enqueueImageJob: async (shotId) => {
    const shot = get().shots.find((item) => item.id === shotId);
    if (!shot) {
      return;
    }
    const job = await mockGenerationAdapter.generateImage(shot);
    set((state) => ({
      generationJobs: [job, ...state.generationJobs],
      shots: state.shots.map((item) =>
        item.id === shotId ? { ...item, imageStatus: "queued" } : item,
      ),
    }));
  },
  enqueueVideoJob: async (shotId) => {
    const shot = get().shots.find((item) => item.id === shotId);
    if (!shot) {
      return;
    }
    const job = await mockGenerationAdapter.generateVideo(
      shot,
      shot.approvedImageAssetId,
    );
    set((state) => ({
      generationJobs: [job, ...state.generationJobs],
      shots: state.shots.map((item) =>
        item.id === shotId ? { ...item, videoStatus: "queued" } : item,
      ),
    }));
  },
}));
