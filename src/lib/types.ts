import { getDbProjectBundle } from "@/lib/local-db";

export type ReturnTypeOfProjectBundle = Awaited<ReturnType<typeof getDbProjectBundle>>;
