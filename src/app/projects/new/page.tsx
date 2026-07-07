import { NewProjectForm } from "@/components/studio/new-project-form";

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">建立新專案</h1>
        <p className="mt-2 text-muted-foreground">
          先設定故事類型、預設比例、語言、模型與成本上限。
        </p>
      </div>
      <NewProjectForm />
    </div>
  );
}
