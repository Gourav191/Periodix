import { useState, useEffect } from "react";
import { Plus, GraduationCap, Building2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusCard } from "@/components/StatusCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import {
  createBatch,
  getBatches,
  createDepartment,
  getDepartments,
  type Batch,
  type Department,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NEW_DEPT = "__NEW_DEPT__";

export default function Batches() {
  const { toast } = useToast();
  const { batches, setBatches, departments, setDepartments, canEditDepartmentsBatches } =
    useAppStore();

  const canCreate = canEditDepartmentsBatches();

  const [loading, setLoading] = useState(false);
  const [createdBatch, setCreatedBatch] = useState<Batch | null>(null);

  const [form, setForm] = useState({
    program: "",
    departmentId: "",
    newDepartmentName: "",
    startYear: new Date().getFullYear(),
    durationYears: 4,
    sectionsCount: 2,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [deptRes, batchRes] = await Promise.all([getDepartments(), getBatches()]);
      if (cancelled) return;

      if (deptRes.data) setDepartments(deptRes.data);
      if (batchRes.data) setBatches(batchRes.data);
    }

    load().catch((e) => {
      toast({
        title: "Failed to load data",
        description: e?.message || "Backend not reachable",
        variant: "destructive",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [setBatches, setDepartments, toast]);

  const selectedDepartment: Department | undefined =
    departments.find((d) => d.id === form.departmentId) ||
    (createdBatch?.departmentId
      ? departments.find((d) => d.id === createdBatch.departmentId)
      : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreate) {
      toast({
        title: "Permission denied",
        description: "Only ADMIN can create Departments/Batches.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let deptId = form.departmentId;

      if (deptId === NEW_DEPT) {
        const name = form.newDepartmentName.trim();
        if (!name) {
          toast({
            title: "Department required",
            description: "Enter a new Department name.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const deptRes = await createDepartment({ name });
        if (deptRes.error || !deptRes.data) {
          toast({
            title: "Failed to create Department",
            description: deptRes.error || "Unknown error",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // update store list (if new)
        const exists = departments.some((d) => d.id === deptRes.data!.id);
        if (!exists)
          setDepartments([...departments, deptRes.data!].sort((a, b) => a.name.localeCompare(b.name)));
        deptId = deptRes.data!.id;
      }

      if (!deptId || deptId === NEW_DEPT) {
        toast({
          title: "Department required",
          description: "Select a Department (or create a new one).",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const result = await createBatch({
        program: form.program,
        departmentId: deptId,
        startYear: form.startYear,
        durationYears: form.durationYears,
        sectionsCount: form.sectionsCount,
      });

      if (result.error) {
        toast({
          title: "Error creating batch",
          description: result.error,
          variant: "destructive",
        });
      } else if (result.data) {
        toast({ title: "Batch created successfully" });
        setBatches([result.data, ...batches]);
        setCreatedBatch(result.data);
        setForm({
          program: "",
          departmentId: "",
          newDepartmentName: "",
          startYear: new Date().getFullYear(),
          durationYears: 4,
          sectionsCount: 2,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Batches</h1>
        <p className="page-description">Create and manage student batches</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusCard title="Create New Batch" icon={<Plus className="w-4 h-4" />}>
          {!canCreate ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Lock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Only <span className="font-medium">ADMIN</span> can create Departments and Batches.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="program">Program</Label>
                <Input
                  id="program"
                  placeholder="e.g., B.Tech"
                  value={form.program}
                  onChange={(e) => setForm({ ...form, program: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_DEPT}>+ Create new Department</SelectItem>
                  </SelectContent>
                </Select>

                {form.departmentId === NEW_DEPT && (
                  <Input
                    placeholder="New Department name (e.g., Computer Science)"
                    value={form.newDepartmentName}
                    onChange={(e) => setForm({ ...form, newDepartmentName: e.target.value })}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startYear">Start Year</Label>
                  <Input
                    id="startYear"
                    type="number"
                    value={form.startYear}
                    onChange={(e) => setForm({ ...form, startYear: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="durationYears">Duration (Years)</Label>
                  <Input
                    id="durationYears"
                    type="number"
                    min={1}
                    max={6}
                    value={form.durationYears}
                    onChange={(e) => setForm({ ...form, durationYears: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sectionsCount">Number of Sections</Label>
                <Input
                  id="sectionsCount"
                  type="number"
                  min={1}
                  max={10}
                  value={form.sectionsCount}
                  onChange={(e) => setForm({ ...form, sectionsCount: parseInt(e.target.value) })}
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <LoadingSpinner size="sm" /> : "Create Batch"}
              </Button>
            </form>
          )}
        </StatusCard>

        <StatusCard title="Batch Details" icon={<GraduationCap className="w-4 h-4" />}>
          {createdBatch ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {createdBatch.department?.name || selectedDepartment?.name || "Department"}
                  {createdBatch.program ? <span className="text-muted-foreground">• {createdBatch.program}</span> : null}
                </h4>
                <p className="text-sm text-muted-foreground">
                  Starting {createdBatch.startYear} • {createdBatch.durationYears} years
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Sections Created:</p>
                <div className="flex flex-wrap gap-2">
                  {createdBatch.sections?.map((sec) => (
                    <span key={sec.id} className="status-badge bg-primary/10 text-primary">
                      Section {sec.name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Semesters Created:</p>
                <div className="flex flex-wrap gap-2">
                  {createdBatch.semesters?.map((sem) => (
                    <span key={sem.id} className="status-badge bg-secondary text-secondary-foreground">
                      Semester {sem.semesterNo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Create a batch to see details here
            </div>
          )}
        </StatusCard>
      </div>

      {batches.length > 0 && (
        <div className="mt-8">
          <h2 className="section-title">Existing Batches</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch) => (
              <div key={batch.id} className="card-soft p-4">
                <h4 className="font-medium text-foreground">
                  {batch.department?.name || "Department"}
                  {batch.program ? <span className="text-muted-foreground"> • {batch.program}</span> : null}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {batch.startYear} • {batch.durationYears} years • {batch.sectionsCount} sections
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
