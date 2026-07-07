import { spawn } from "node:child_process";

const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:3000";
let devServer = null;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${payload.error ?? response.statusText}`);
  }
  return payload;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await sleep(750);
    }
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function ensureServer() {
  try {
    await fetch(baseUrl);
    return;
  } catch {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    devServer = spawn(command, ["run", "dev"], { stdio: "ignore", shell: false });
    await waitForServer();
  }
}

async function main() {
  await ensureServer();

  const { projectId } = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: `MVP Smoke ${Date.now()}`,
      description: "Automated MVP smoke test project.",
      type: "shorts",
      defaultAspectRatio: "9:16",
      defaultLanguage: "bilingual",
      defaultStyle: "cinematic, consistent character bible, teal highlights",
      defaultSegmentCount: 5,
      defaultImageModel: "local_mock_image",
      defaultVideoModel: "local_mock_video",
      costLimit: 200,
    }),
  });

  await request(`/api/projects/${projectId}/source-documents`, {
    method: "POST",
    body: JSON.stringify({
      filename: "smoke-story.md",
      fileType: "md",
      rawText:
        "一位少年在海邊撿到會發光的羅盤，發現它指向失蹤多年的母親。每一次轉動羅盤，城市都會浮現一段被遺忘的記憶。少年必須在黎明前做出選擇。",
    }),
  });

  const analysis = await request(`/api/projects/${projectId}/analyze-story`, {
    method: "POST",
    body: JSON.stringify({
      sourceText:
        "一位少年在海邊撿到會發光的羅盤，發現它指向失蹤多年的母親。每一次轉動羅盤，城市都會浮現一段被遺忘的記憶。少年必須在黎明前做出選擇。",
      settings: {
        storyTheme: "親情與冒險",
        videoType: "shorts",
        targetAudience: "短影音觀眾",
        defaultLanguage: "bilingual",
        segmentCount: 5,
        defaultStyle: "cinematic, consistent character bible, teal highlights",
        notes: "smoke test",
      },
    }),
  });
  if (analysis.segments.length !== 5) throw new Error("Expected 5 generated segments.");
  await request(`/api/projects/${projectId}/segments/approve`, { method: "POST", body: "{}" });

  const seo = await request(`/api/projects/${projectId}/seo/generate`, { method: "POST", body: "{}" });
  await request(`/api/projects/${projectId}/seo`, {
    method: "PUT",
    body: JSON.stringify({ seoPackage: seo.seoPackage, approve: true }),
  });

  const scripts = await request(`/api/projects/${projectId}/scripts/generate`, { method: "POST", body: "{}" });
  await request(`/api/projects/${projectId}/scripts`, {
    method: "PUT",
    body: JSON.stringify({ scripts: scripts.scripts, approve: true }),
  });

  const shots = await request(`/api/projects/${projectId}/shots/generate`, { method: "POST", body: "{}" });
  await request(`/api/projects/${projectId}/shots`, {
    method: "PUT",
    body: JSON.stringify({ shots: shots.shots, approve: true }),
  });

  await request(`/api/projects/${projectId}/characters/extract`, { method: "POST", body: "{}" });
  await request(`/api/projects/${projectId}/characters/apply`, { method: "POST", body: "{}" });

  await request(`/api/projects/${projectId}/images`, {
    method: "POST",
    body: JSON.stringify({ action: "generate", allPending: true }),
  });

  await request(`/api/projects/${projectId}/videos`, {
    method: "POST",
    body: JSON.stringify({
      action: "generate",
      allPending: true,
      settings: {
        mode: "image-to-video",
        model: "local_mock_video",
        duration: 4,
        aspectRatio: "9:16",
        resolution: "720p",
        fps: 24,
        outputFormat: "mp4",
        audioMode: "none",
      },
    }),
  });

  await request(`/api/projects/${projectId}/exports`, {
    method: "POST",
    body: JSON.stringify({ exportType: "full_project_export", extension: "zip" }),
  });

  const health = await request(`/api/projects/${projectId}/health`);
  if (health.healthScore <= 0) throw new Error("Health check returned an invalid score.");

  console.log(JSON.stringify({ ok: true, projectId, healthScore: health.healthScore }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (devServer) devServer.kill();
  });
