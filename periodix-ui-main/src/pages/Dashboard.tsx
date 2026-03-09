import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Download,
  Eye,
  Zap,
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard, StatItem, WarningItem } from "@/components/StatusCard";
import { BatchSelector, SemesterSelector } from "@/components/Selectors";
import { DataTable } from "@/components/DataTable";
import { LoadingState } from "@/components/LoadingSpinner";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

import {
  getSubjects,
  getFaculty,
  getAssignments,
  getActiveTimetable,
  getTimetableEntries,
  downloadTimetablePdf,
  saveBlob,
  type Faculty,
  type TimetableEntry,
} from "@/lib/api";

interface FacultyLoadItem extends Faculty {
  usedHours: number;
  status: "ok" | "near-cap" | "low";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

    const {
    selectedSemesterId,
    selectedTimetableId,
    setSelectedTimetableId,
    lastGenerateResult,
    faculty,
    setFaculty,
    batches,
    selectedBatchId,
    // keep these if you use them elsewhere:
    getSelectedBatch,
    getSelectedSemester,
  } = useAppStore();

  const [subjectsCount, setSubjectsCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [activeEntries, setActiveEntries] = useState<TimetableEntry[]>([]);
  const [facultyLoad, setFacultyLoad] = useState<FacultyLoadItem[]>([]);

   // ✅ get selected batch reactively (depends on selectedBatchId + batches)
  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) return null;
    return batches.find((b) => b.id === selectedBatchId) || null;
  }, [batches, selectedBatchId]);

  // ✅ departmentId updates instantly when batch changes
  const selectedDeptId = selectedBatch?.departmentId ?? null;

  // ✅ Filter faculty instantly
  const facultyForThisBatch = useMemo(() => {
    const activeOnly = faculty.filter((f) => f.isActive !== false);
    if (!selectedDeptId) return activeOnly;
    return activeOnly.filter((f) => f.departmentId === selectedDeptId);
  }, [faculty, selectedDeptId]);

  // 1) Fetch semester data (subjects/faculty/assignments) + ACTIVE timetable + entries
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      if (!selectedSemesterId || !selectedDeptId) return;
const [subjectsRes, facultyRes, assignmentsRes] = await Promise.all([
  getSubjects(selectedSemesterId),
  getFaculty(selectedDeptId),
  getAssignments(selectedSemesterId),
]);

      setLoading(true);

      try {
        const [subjectsRes, facultyRes, assignmentsRes] = await Promise.all([
          getSubjects(selectedSemesterId),
          getFaculty(selectedDeptId || undefined),
          getAssignments(selectedSemesterId),
        ]);

        if (cancelled) return;

        if (subjectsRes.data) setSubjectsCount(subjectsRes.data.length);
        if (facultyRes.data) setFaculty(facultyRes.data);
        if (assignmentsRes.data) setAssignmentsCount(assignmentsRes.data.length);

        // Load ACTIVE timetable for this semester
        const activeRes = await getActiveTimetable(selectedSemesterId);
        if (cancelled) return;

        if (activeRes.error) {
          toast({
            title: "Failed to load active timetable",
            description: activeRes.error,
            variant: "destructive",
          });
          setActiveEntries([]);
          setLoading(false);
          return;
        }

        const active = activeRes.data;
        if (!active?.id) {
          // no active timetable yet
          setActiveEntries([]);
          setLoading(false);
          return;
        }

        // store it so View/PDF buttons can work
        setSelectedTimetableId(active.id);

        // Load entries of ACTIVE timetable
        const entriesRes = await getTimetableEntries(active.id);
        if (cancelled) return;

        if (entriesRes.error || !entriesRes.data) {
          toast({
            title: "Failed to load timetable entries",
            description: entriesRes.error || "Unknown error",
            variant: "destructive",
          });
          setActiveEntries([]);
          setLoading(false);
          return;
        }

        setActiveEntries(entriesRes.data);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        toast({
          title: "Failed to load dashboard data",
          description: e?.message || "Unknown error",
          variant: "destructive",
        });
        setActiveEntries([]);
        setLoading(false);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId, setFaculty, toast, setSelectedTimetableId]);

  // 2) Compute faculty load from ACTIVE timetable entries
  useEffect(() => {
    if (!facultyForThisBatch?.length) {
      setFacultyLoad([]);
      return;
    }

    // hours per faculty from entries: each entry represents one period => 1 hour per faculty in that entry
    const usedMap: Record<string, number> = {};
    for (const e of activeEntries) {
      const facIds =
        (e.faculties || []).map((x) => x.facultyId).filter(Boolean) as string[];
      for (const fid of facIds) {
        usedMap[fid] = (usedMap[fid] || 0) + 1;
      }
    }

    const load: FacultyLoadItem[] = facultyForThisBatch.map((f) => {
      const usedHours = usedMap[f.id] || 0;
      const max = f.maxHoursPerWeek || 16;
      const ratio = max > 0 ? usedHours / max : 0;

      let status: FacultyLoadItem["status"] = "ok";
      if (ratio >= 0.9) status = "near-cap";
      else if (ratio < 0.3) status = "low";

      return { ...f, usedHours, status };
    });

    setFacultyLoad(load);
  }, [activeEntries, facultyForThisBatch]);

  const handleDownloadPdf = async () => {
    if (!selectedTimetableId) {
      toast({
        title: "No timetable selected",
        description: "Generate a timetable first (or ensure one is ACTIVE).",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Downloading PDF..." });
    const res = await downloadTimetablePdf(selectedTimetableId);

    if (res.error || !res.data) {
      toast({
        title: "Download failed",
        description: res.error || "PDF download failed",
        variant: "destructive",
      });
      return;
    }

    // ✅ Better filename: Batch + Semester + Timetable
    const batch = getSelectedBatch();
    const sem = getSelectedSemester();

    const deptName = batch?.department?.name || "";
    const program = batch?.program || "Batch";
    const year = batch?.startYear ? String(batch.startYear) : "";

    const batchName = [program, deptName].filter(Boolean).join(" ").trim() || "Batch";
    const semName = sem?.semesterNo ? `Semester ${sem.semesterNo}` : "Semester";

    const safe = (s: string) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").trim();

    saveBlob(
      res.data,
      `${safe(batchName)} ${safe(year)} ${safe(semName)} Timetable.pdf`
        .replace(/\s+/g, " ")
        .trim()
    );
  };

  // warnings still come from last generation (optional)
  const warnings = lastGenerateResult?.warnings || [];
  const highWarnings = warnings.filter(
    (w) => w.toLowerCase().includes("error") || w.toLowerCase().includes("conflict")
  );
  const mediumWarnings = warnings.filter((w) => !highWarnings.includes(w));

  const activeSummary = useMemo(() => {
    return {
      entriesCount: activeEntries.length,
    };
  }, [activeEntries.length]);

  return (
    <div className="animate-fade-in max-w-6xl">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Overview of timetable setup and status</p>
      </div>

      {/* Top Bar */}
      <div className="card-soft p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <BatchSelector />
          <SemesterSelector />
          <div className="flex-1" />
          <Button onClick={() => navigate("/generate")} className="gap-2">
            <Zap className="w-4 h-4" />
            Generate Timetable
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/timetable")}
            disabled={!selectedTimetableId}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            View Timetable
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={!selectedTimetableId}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading semester data..." />
      ) : !selectedSemesterId ? (
        <div className="card-soft p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-foreground mb-2">No Semester Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a batch and semester to view the dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Semester Setup Status */}
          <StatusCard
            title="Semester Setup Status"
            icon={<BookOpen className="w-4 h-4" />}
            actions={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate("/semester-setup")}>
                  Add Subjects
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/faculty")}>
                  Add Faculty
                </Button>
              </div>
            }
          >
            <div className="space-y-1">
              <StatItem label="Subjects" value={subjectsCount} />
              {/* ✅ Department-filtered count */}
              <StatItem label="Faculty Active" value={facultyForThisBatch.length} />
              <StatItem
                label="Assignments"
                value={assignmentsCount}
                status={assignmentsCount > 0 ? "success" : "warning"}
              />
            </div>

            {subjectsCount === 0 && (
              <div className="mt-4">
                <WarningItem message="No subjects configured yet" level="medium" />
              </div>
            )}
          </StatusCard>

          {/* Active Timetable Summary */}
          <StatusCard title="Active Timetable Summary" icon={<Calendar className="w-4 h-4" />}>
            {selectedTimetableId ? (
              <div className="space-y-1">
                <StatItem
                  label="Active Entries"
                  value={activeSummary.entriesCount}
                  status={activeSummary.entriesCount > 0 ? "success" : "warning"}
                />
                <StatItem
                  label="Last Generate Warnings"
                  value={warnings.length}
                  status={warnings.length > 0 ? "warning" : "success"}
                />
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No active timetable found yet
              </div>
            )}
          </StatusCard>

          {/* Generator Alerts */}
          <StatusCard title="Generator Alerts" icon={<AlertTriangle className="w-4 h-4" />}>
            {warnings.length === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
                <p className="text-sm text-muted-foreground">No warnings</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {highWarnings.slice(0, 3).map((w, i) => (
                  <WarningItem key={i} message={w} level="high" />
                ))}
                {mediumWarnings.slice(0, 5).map((w, i) => (
                  <WarningItem key={i} message={w} level="medium" />
                ))}
              </div>
            )}
          </StatusCard>

          {/* Faculty Load Overview */}
          <StatusCard title="Faculty Load Overview" icon={<Users className="w-4 h-4" />}>
            {facultyLoad.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Generate a timetable (or ensure one is ACTIVE) to see faculty load
              </div>
            ) : (
              <DataTable
                data={facultyLoad}
                columns={[
                  { key: "name", header: "Faculty" },
                  { key: "usedHours", header: "Used" },
                  { key: "maxHoursPerWeek", header: "Max" },
                  {
                    key: "status",
                    header: "Status",
                    render: (item) => (
                      <span
                        className={
                          item.status === "ok"
                            ? "status-success"
                            : item.status === "near-cap"
                            ? "status-warning"
                            : "status-error"
                        }
                      >
                        {item.status === "ok"
                          ? "OK"
                          : item.status === "near-cap"
                          ? "At Max"
                          : "Low"}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </StatusCard>
        </div>
      )}
    </div>
  );
}
