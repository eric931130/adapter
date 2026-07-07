import rawCapabilities from "@/data/model-capabilities.json";
import {
  modelCapabilitiesSchema,
  type ModelCapabilities,
} from "@/lib/schemas";

export const modelCapabilities: ModelCapabilities =
  modelCapabilitiesSchema.parse(rawCapabilities);

export function getImageModelOptions() {
  return modelCapabilities.imageModels;
}

export function getVideoModelOptions() {
  return modelCapabilities.videoModels;
}

export function getTextModelOptions() {
  return modelCapabilities.textModels;
}
