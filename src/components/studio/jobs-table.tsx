import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/studio/status-badge";
import type { GenerationJob } from "@/lib/schemas";

const typeLabels: Record<string, string> = {
  text_analysis: "文本分析",
  prompt_generation: "提示詞生成",
  image: "圖片",
  video: "影片",
  transition: "轉場",
  export: "匯出",
};

export function JobsTable({ jobs }: { jobs: GenerationJob[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card/80 backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>紀錄</TableHead>
            <TableHead>類型</TableHead>
            <TableHead>服務商</TableHead>
            <TableHead>模型</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead className="text-right">費用</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length ? (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.id}</TableCell>
                <TableCell>{typeLabels[job.type] ?? job.type}</TableCell>
                <TableCell>{job.provider}</TableCell>
                <TableCell>{job.model}</TableCell>
                <TableCell>
                  <StatusBadge status={job.status} />
                </TableCell>
                <TableCell className="text-right">
                  ${(job.actualCost ?? job.estimatedCost).toFixed(2)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                尚無 API 呼叫或匯出紀錄。
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
