import { useEffect, useMemo, useState } from "react";
import { Trash2, Link2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/StatusCard";
import { LoadingState } from "@/components/LoadingSpinner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

import { BatchSelector, SemesterSelector, SectionSelector } from "@/components/Selectors";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import {
  createAssignment,
  deleteAssignment,
  getAssignments,
  getFaculty,
  getSubjects,
  getFacultyLoad,
  type TeachingAssignment,
  type Faculty,
  type Subject,
} from "@/lib/api";

function getAssignmentFacultyNames(a: TeachingAssignment) {
  const names =
    (a.faculties || [])
      .map((x) => x.faculty?.name)
      .filter(Boolean) as string[];
  return names;
}

export default function Assignments() {
  const { toast } = useToast();
  const { selectedSemesterId, selectedSectionId, getSelectedBatch } = useAppStore();

  const [loading, setLoading] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);

  const [subjectId, setSubjectId] = useState<string>("");
  const [facultyId, setFacultyId] = useState<string>(""); // for THEORY/NON_CREDIT
  const [labFacultyIds, setLabFacultyIds] = useState<string[]>([]); // for LAB (1..3)

  // facultyId -> hours/week (estimated from assignments)
  const [facultyLoadMap, setFacultyLoadMap] = useState<Record<string, number>>({});

  const selectedBatch = getSelectedBatch();
  const batchDepartmentId = selectedBatch?.departmentId || "";

  // ----------------------------
  // Load Subjects/Faculty/Assignments when semester changes
  // ----------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!selectedSemesterId) {
        setSubjects([]);
        setFaculty([]);
        setAssignments([]);
        setFacultyLoadMap({});
        return;
      }

      setLoading(true);

      const [subRes, facRes, asgRes, loadRes] = await Promise.all([
        getSubjects(selectedSemesterId),
        getFaculty(batchDepartmentId || undefined),
        getAssignments(selectedSemesterId),
        getFacultyLoad(selectedSemesterId),
      ]);

      if (cancelled) return;

      if (subRes.data) setSubjects(subRes.data);
      if (facRes.data) setFaculty(facRes.data);
      if (asgRes.data) setAssignments(asgRes.data);
      if (loadRes.data) setFacultyLoadMap(loadRes.data);

      setLoading(false);
    }

    loadAll().catch((e) => {
      toast({
        title: "Failed to load data",
        description: e?.message || "Backend not reachable",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId, batchDepartmentId, toast]);

  // Reset faculty selection when subject changes
  useEffect(() => {
    setFacultyId("");
    setLabFacultyIds([]);
  }, [subjectId]);

  // ----------------------------
  // Filter assignments by selected section
  // ----------------------------
  const sectionAssignments = useMemo(() => {
    if (!selectedSectionId) return [];
    return assignments.filter((a) => a.sectionId === selectedSectionId);
  }, [assignments, selectedSectionId]);

  // ----------------------------
  // Helpers
  // ----------------------------
  const refreshAssignmentsAndLoad = async () => {
    if (!selectedSemesterId) return;

    const [asgRes, loadRes] = await Promise.all([
      getAssignments(selectedSemesterId),
      getFacultyLoad(selectedSemesterId),
    ]);

    if (asgRes.data) setAssignments(asgRes.data);
    if (loadRes.data) setFacultyLoadMap(loadRes.data);
  };

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );

  const labHours = useMemo(() => {
    if (!selectedSubject) return 0;
    if (selectedSubject.type === "LAB") return Number(selectedSubject.labDurationHours || 2);
    return 1;
  }, [selectedSubject]);

  const selectedFacultyIds = useMemo(() => {
    if (!selectedSubject) return [];
    return selectedSubject.type === "LAB" ? labFacultyIds : facultyId ? [facultyId] : [];
  }, [selectedSubject, labFacultyIds, facultyId]);

  const facultyById = useMemo(() => {
    const m = new Map<string, Faculty>();
    for (const f of faculty) m.set(f.id, f);
    return m;
  }, [faculty]);

  const loadPreview = useMemo(() => {
    // array of { id, name, used, max, willBe, exceeds }
    return selectedFacultyIds.map((fid) => {
      const f = facultyById.get(fid);
      const used = facultyLoadMap[fid] || 0;
      const max = f?.maxHoursPerWeek ?? 16;
      const willBe = used + labHours;
      return {
        id: fid,
        name: f?.name || fid,
        used,
        max,
        willBe,
        exceeds: willBe > max,
      };
    });
  }, [selectedFacultyIds, facultyById, facultyLoadMap, labHours]);

  // ----------------------------
  // Create Assignment
  // ----------------------------
  const handleCreate = async () => {
    if (!selectedSemesterId) {
      toast({
        title: "No semester selected",
        description: "Select a batch + semester first.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSectionId) {
      toast({
        title: "No section selected",
        description: "Select a section to assign faculty.",
        variant: "destructive",
      });
      return;
    }

    if (!subjectId) {
      toast({
        title: "Missing fields",
        description: "Select a subject.",
        variant: "destructive",
      });
      return;
    }

    const ids = selectedFacultyIds;

    if (selectedSubject?.type === "LAB") {
      if (ids.length < 1 || ids.length > 3) {
        toast({
          title: "Select lab faculty",
          description: "For LAB, choose 1 to 3 faculties.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (ids.length !== 1) {
        toast({
          title: "Select faculty",
          description: "Choose exactly 1 faculty for THEORY/NON_CREDIT.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    const res = await createAssignment(selectedSemesterId, {
      sectionId: selectedSectionId,
      subjectId,
      facultyIds: ids,
    });

    if (res.error) {
      toast({
        title: "Failed to save assignment",
        description: res.error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const warning = (res.data as any)?.warning;
    if (warning) {
      toast({
        title: "Saved (with warning)",
        description: warning,
      });
    } else {
      toast({ title: "Assignment saved successfully" });
    }

    setSubjectId("");
    setFacultyId("");
    setLabFacultyIds([]);

    await refreshAssignmentsAndLoad();
    setLoading(false);
  };

  const handleDelete = async (assignmentId: string) => {
    setLoading(true);

    const res = await deleteAssignment(assignmentId);
    if (res.error) {
      toast({
        title: "Delete failed",
        description: res.error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({ title: "Assignment deleted" });
    await refreshAssignmentsAndLoad();
    setLoading(false);
  };

  // ----------------------------
  // UI helpers
  // ----------------------------
  const labSelectionLabel = useMemo(() => {
    if (labFacultyIds.length === 0) return "Select lab faculty (1–3)";
    const names = labFacultyIds.map((id) => facultyById.get(id)?.name || id);
    return names.join(", ");
  }, [labFacultyIds, facultyById]);

  const toggleLabFaculty = (id: string, checked: boolean) => {
    setLabFacultyIds((prev) => {
      const set = new Set(prev);
      if (checked) {
        if (set.has(id)) return prev;
        if (set.size >= 3) return prev; // cap 3
        return [...prev, id];
      } else {
        set.delete(id);
        return [...set];
      }
    });
  };

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="animate-fade-in max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Assignments</h1>
        <p className="page-description">Assign faculty to subjects for each section</p>
      </div>

      {/* Top selectors */}
      <div className="card-soft p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <BatchSelector />
          <SemesterSelector />
          <SectionSelector />
        </div>
        {selectedBatch?.department?.name && (
          <div className="mt-3 text-xs text-muted-foreground">
            Showing faculty from <span className="font-medium text-foreground">{selectedBatch.department.name}</span> only.
          </div>
        )}
      </div>

      {!selectedSemesterId ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          Select a batch and semester to manage assignments.
        </div>
      ) : !selectedSectionId ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          Select a section to view/create assignments.
        </div>
      ) : loading && subjects.length === 0 && faculty.length === 0 ? (
        <LoadingState message="Loading..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Assignment */}
          <StatusCard title="Create Assignment" icon={<Plus className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code ? `${s.code} — ${s.name}` : s.name}{" "}
                        {s.type === "LAB" ? "(LAB)" : s.type === "NON_CREDIT" ? "(NON-CREDIT)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSubject?.type === "LAB" ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Lab Faculty (1–3)
                  </Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="truncate">{labSelectionLabel}</span>
                        <span className="text-muted-foreground text-xs">{labFacultyIds.length}/3</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <ScrollArea className="h-64 p-3">
                        <div className="space-y-2">
                          {faculty.map((f) => {
                            const checked = labFacultyIds.includes(f.id);
                            const disableAdd = !checked && labFacultyIds.length >= 3;
                            return (
                              <label
                                key={f.id}
                                className={`flex items-center gap-2 text-sm rounded-md px-2 py-1 hover:bg-muted ${
                                  disableAdd ? "opacity-60" : ""
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={disableAdd}
                                  onCheckedChange={(v) => toggleLabFaculty(f.id, Boolean(v))}
                                />
                                <span>{f.name}</span>
                              </label>
                            );
                          })}
                          {faculty.length === 0 && (
                            <div className="text-sm text-muted-foreground">
                              No faculty found for this department.
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  <p className="text-xs text-muted-foreground">
                    Example display: <span className="font-medium">DS Lab (Dr. A, Dr. B, Dr. C)</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Faculty</Label>
                  <Select value={facultyId} onValueChange={setFacultyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      {faculty.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Faculty load preview */}
              {selectedSubject && loadPreview.length > 0 && (
                <div className="text-sm space-y-1">
                  <div className="text-muted-foreground">
                    {selectedSubject.type === "LAB"
                      ? `This LAB adds ${labHours}h to each selected faculty.`
                      : `This adds ${labHours}h to the selected faculty.`}
                  </div>

                  {loadPreview.map((x) => (
                    <div key={x.id} className="text-muted-foreground">
                      {x.name}:{" "}
                      <span className="font-medium text-foreground">{x.used}h</span> / {x.max}h • After:{" "}
                      <span className={`font-medium ${x.exceeds ? "text-destructive" : "text-foreground"}`}>
                        {x.willBe}h
                      </span>
                      {x.exceeds ? (
                        <span className="ml-2 text-destructive">⚠️ exceeds</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={
                  loading ||
                  !subjectId ||
                  (selectedSubject?.type === "LAB" ? labFacultyIds.length === 0 : !facultyId)
                }
              >
                {loading ? "Saving..." : "Save Assignment"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Tip: If the same subject is already assigned for this section, saving again will replace the faculty selection.
              </p>
            </div>
          </StatusCard>

          {/* Assignments list (filtered) */}
          <StatusCard title="Assignments" icon={<Link2 className="w-4 h-4" />}>
            {sectionAssignments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No assignments for this section yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_1.2fr_40px] gap-4 px-2 py-2 text-xs font-medium text-muted-foreground">
                  <div>SUBJECT</div>
                  <div>FACULTY</div>
                  <div />
                </div>

                {sectionAssignments.map((a) => {
                  const facNames = getAssignmentFacultyNames(a);
                  const facText = facNames.length ? facNames.join(", ") : "—";
                  const subjText = a.subject?.code ? a.subject.code : a.subject?.name || a.subjectId;

                  return (
                    <div
                      key={a.id}
                      className="grid grid-cols-[1fr_1.2fr_40px] gap-4 px-2 py-3 items-center"
                    >
                      <div className="text-sm">{subjText}</div>
                      <div className="text-sm">
                        {a.subject?.type === "LAB"
                          ? `${a.subject?.name || subjText} (${facText})`
                          : facText}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(a.id)}
                        disabled={loading}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </StatusCard>
        </div>
      )}
    </div>
  );
}
