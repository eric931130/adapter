import { HomeConsole } from "@/components/studio/home-console";
import { readDb } from "@/lib/local-db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await readDb();

  return <HomeConsole db={db} />;
}
