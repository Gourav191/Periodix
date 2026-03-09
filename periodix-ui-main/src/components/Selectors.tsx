import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import type { Batch } from "@/lib/api";

function formatBatchLabel(batch: Batch) {
  const dept = batch.department?.name || "Department";
  const program = batch.program ? `${batch.program} • ` : "";
  const start = batch.startYear ?? "";
  const end = batch.endYear ?? "";
  return end ? `${program}${dept} — ${start}–${end}` : `${program}${dept} — ${start}`;
}

export function BatchSelector() {
  const { batches, selectedBatchId, setSelectedBatchId } = useAppStore();

  return (
    <Select value={selectedBatchId || ""} onValueChange={(v) => setSelectedBatchId(v || null)}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select Batch" />
      </SelectTrigger>
      <SelectContent>
        {batches.map((batch) => (
          <SelectItem key={batch.id} value={batch.id}>
            {formatBatchLabel(batch)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SemesterSelector() {
  const { selectedSemesterId, setSelectedSemesterId, getSelectedBatch } = useAppStore();

  const batch = getSelectedBatch();
  const semesters = batch?.semesters ?? [];

  return (
    <Select
      value={selectedSemesterId || ""}
      onValueChange={(v) => setSelectedSemesterId(v || null)}
      disabled={!batch}
    >
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Select Semester" />
      </SelectTrigger>
      <SelectContent>
        {semesters.map((sem) => (
          <SelectItem key={sem.id} value={sem.id}>
            Semester {sem.semesterNo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SectionSelector() {
  const { selectedSectionId, setSelectedSectionId, getSelectedBatch } = useAppStore();

  const batch = getSelectedBatch();
  const sections = batch?.sections ?? [];

  return (
    <Select
      value={selectedSectionId || ""}
      onValueChange={(v) => setSelectedSectionId(v || null)}
      disabled={!batch}
    >
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Select Section" />
      </SelectTrigger>
      <SelectContent>
        {sections.map((sec) => (
          <SelectItem key={sec.id} value={sec.id}>
            Section {sec.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
