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

export function JobsTable({ jobs }: { jobs: GenerationJob[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card/80 backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{job.id}</TableCell>
              <TableCell>{job.type}</TableCell>
              <TableCell>{job.provider}</TableCell>
              <TableCell>{job.model}</TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-right">
                ${(job.actualCost ?? job.estimatedCost).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
