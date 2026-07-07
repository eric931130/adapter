# Story-to-Video AI Studio

AI 故事影音自動化生成平台 MVP 骨架。

核心流程：

故事原稿 -> AI 分析 -> 劇情片段 -> SEO 劇情包裝 -> 正式劇本 -> 分鏡提示詞 -> 角色一致性管理 -> 分鏡圖片生成 -> 圖生影片 / 文生影片 -> 匯出圖片、影片、Excel、PDF、Word、ZIP。

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Zod schemas
- Zustand client state
- Local mock data now, Prisma / SQLite / PostgreSQL-ready later
- Adapter-first AI provider boundary
- Local mock GenerationJob queue

## Run

```bash
npm install
npm run dev
npm run lint
npm run build
```

Open `http://localhost:3000`.

## Key Folders

```text
src/app                         App Router pages
src/components/studio           Product shell and workflow UI
src/components/ui               shadcn/ui components
src/lib/schemas.ts              Zod schemas and TypeScript types
src/lib/mock-data.ts            MVP seed data
src/data/model-capabilities.json Model registry used by UI and adapters
src/adapters/ai-adapter.ts      Mock generation provider interface
src/store/studio-store.ts       Zustand state and mock queue actions
```

## Architecture Rules

- All model options come from `src/data/model-capabilities.json`.
- Image and video generation create `GenerationJob` records first.
- Regeneration should append a new `Asset.version`, never overwrite the old asset.
- Each workflow stage keeps explicit approval state.
- Returning to an earlier stage should warn that downstream outputs may be stale.
- Real provider integrations should implement the adapter contract instead of calling APIs directly from UI components.
