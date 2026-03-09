// src/pages/TimetableViewer.tsx
import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/StatusCard";
import { BatchSelector, SemesterSelector } from "@/components/Selectors";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import {
  downloadTimetablePdf,
  getActiveTimetable,
  getTimetableEntries,
  saveBlob,
  type TimetableEntry,
} from "@/lib/api";

const DAYS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const PERIODS = [1, 2, 3, 4, 5, 6];

// Layout: Day | P1 P2 P3 | Lunch | P4 P5 P6
const PRE_LUNCH = [1, 2, 3];
const POST_LUNCH = [4, 5, 6];

function entryFacultyNames(e?: TimetableEntry) {
  return (e?.faculties || [])
    .map((x) => x.faculty?.name)
    .filter(Boolean) as string[];
}

function cellTextForSection(e?: TimetableEntry) {
  if (!e) return "";
  const code = e.subject?.code || e.subject?.name || "";
  const names = entryFacultyNames(e).join(", ");
  return names ? `${code} (${names})` : code;
}

function cellTextForFaculty(e: TimetableEntry) {
  const code = e.subject?.code || e.subject?.name || "";
  const sec = e.section?.name || "";
  return sec ? `${code} (Sec ${sec})` : code;
}

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

export default function TimetableViewer() {
  const { toast } = useToast();

  const selectedSemesterId = useAppStore((s) => s.selectedSemesterId);
  const selectedTimetableId = useAppStore((s) => s.selectedTimetableId);
  const setSelectedTimetableId = useAppStore((s) => s.setSelectedTimetableId);

  const faculty = useAppStore((s) => s.faculty);
  const getSelectedDepartment = useAppStore((s) => s.getSelectedDepartment);

  const [layoutMode, setLayoutMode] = useState<"SECTION" | "FACULTY">("SECTION");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  // ✅ Batch-wise department (for faculty filtering)
  const selectedDepartment = useMemo(() => getSelectedDepartment(), [getSelectedDepartment]);
  const selectedDeptId = selectedDepartment?.id || null;

  // Auto-load ACTIVE timetable whenever semester changes
  useEffect(() => {
    let cancelled = false;

    async function loadActive() {
      if (!selectedSemesterId) {
        setSelectedTimetableId(null);
        return;
      }

      const res = await getActiveTimetable(selectedSemesterId);
      if (cancelled) return;

      if (res.error) {
        toast({
          title: "Failed to load active timetable",
          description: res.error,
          variant: "destructive",
        });
        setSelectedTimetableId(null);
        return;
      }

      setSelectedTimetableId(res.data?.id ?? null);
    }

    loadActive();
    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId, setSelectedTimetableId, toast]);

  // Load entries whenever timetable changes
  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      if (!selectedTimetableId) {
        setEntries([]);
        return;
      }

      setLoading(true);
      const res = await getTimetableEntries(selectedTimetableId);
      if (cancelled) return;

      if (res.error || !res.data) {
        toast({
          title: "Failed to load timetable",
          description: res.error || "Unknown error",
          variant: "destructive",
        });
        setEntries([]);
        setLoading(false);
        return;
      }

      setEntries(res.data);
      setLoading(false);
    }

    loadEntries();
    return () => {
      cancelled = true;
    };
  }, [selectedTimetableId, toast]);

  // Maps
  const bySectionName = useMemo(() => {
    const map: Record<string, Record<number, Record<number, TimetableEntry>>> = {};
    for (const e of entries) {
      const secName = e.section?.name || "Unknown";
      map[secName] ??= {};
      map[secName][e.dayOfWeek] ??= {};
      map[secName][e.dayOfWeek][e.periodNo] = e;
    }
    return map;
  }, [entries]);

  const byFacultyName = useMemo(() => {
    const map: Record<string, Record<number, Record<number, TimetableEntry[]>>> = {};

    for (const e of entries) {
      const facNames = entryFacultyNames(e);
      const namesToUse = facNames.length ? facNames : ["Unknown"];

      for (const facName of namesToUse) {
        map[facName] ??= {};
        map[facName][e.dayOfWeek] ??= {};
        map[facName][e.dayOfWeek][e.periodNo] ??= [];
        map[facName][e.dayOfWeek][e.periodNo].push(e);
      }
    }
    return map;
  }, [entries]);

  // Search filtering helpers
  const q = useMemo(() => normalize(search), [search]);

  const sectionNamesToRender = useMemo(() => {
    const all = Object.keys(bySectionName).sort();
    if (!q) return all;

    return all.filter((secName) => {
      if (normalize(secName).includes(q)) return true;

      for (const day of Object.keys(DAYS).map(Number)) {
        for (const p of PERIODS) {
          const e = bySectionName[secName]?.[day]?.[p];
          if (!e) continue;
          const hay = normalize(
            `${e.subject?.code || ""} ${e.subject?.name || ""} ${(entryFacultyNames(e) || []).join(
              " "
            )} ${e.section?.name || ""}`
          );
          if (hay.includes(q)) return true;
        }
      }
      return false;
    });
  }, [bySectionName, q]);

  // ✅ Faculty view: only show faculty from selected batch's department
  const allowedFacultyNameSet = useMemo(() => {
    if (!selectedDeptId) return null; // if batch not selected, don't restrict

    const names = faculty
      .filter((f) => f.departmentId === selectedDeptId)
      .map((f) => f.name)
      .filter(Boolean);

    return new Set<string>(names);
  }, [faculty, selectedDeptId]);

  const facultyNamesToRender = useMemo(() => {
    const fromStore = faculty
      .filter((f) => {
        if (!allowedFacultyNameSet) return true;
        return allowedFacultyNameSet.has(f.name);
      })
      .map((f) => f.name)
      .filter(Boolean);

    const fromEntries = Object.keys(byFacultyName)
      .sort()
      .filter((name) => {
        if (!allowedFacultyNameSet) return true;
        return allowedFacultyNameSet.has(name);
      });

    const set = new Set<string>();
    const ordered: string[] = [];
    for (const n of fromStore) {
      if (!set.has(n)) {
        set.add(n);
        ordered.push(n);
      }
    }
    for (const n of fromEntries) {
      if (!set.has(n)) {
        set.add(n);
        ordered.push(n);
      }
    }

    if (!q) return ordered;

    return ordered.filter((facName) => {
      if (normalize(facName).includes(q)) return true;

      for (const day of Object.keys(DAYS).map(Number)) {
        for (const p of PERIODS) {
          const list = byFacultyName[facName]?.[day]?.[p] || [];
          for (const e of list) {
            const hay = normalize(
              `${e.subject?.code || ""} ${e.subject?.name || ""} ${e.section?.name || ""} ${facName}`
            );
            if (hay.includes(q)) return true;
          }
        }
      }
      return false;
    });
  }, [faculty, byFacultyName, q, allowedFacultyNameSet]);

  const handleDownloadPdf = async () => {
    if (!selectedTimetableId) return;

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

    const batch = useAppStore.getState().getSelectedBatch();
const sem = useAppStore.getState().getSelectedSemester();

const batchName =
  batch?.program
    ? `${batch.program} ${batch.startYear}`
    : `Batch ${batch?.startYear ?? ""}`;

const semName = sem?.semesterNo ? `Semester ${sem.semesterNo}` : "Semester";

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim();

saveBlob(res.data, `${safe(batchName)} ${safe(semName)} Timetable.pdf`);

    toast({ title: "Downloaded", description: "PDF saved successfully." });
  };

  const nothingMatches =
  layoutMode === "FACULTY" &&
  entries.length > 0 &&
  q &&
  facultyNamesToRender.length === 0;


  // -------------------------
  // Rendering helpers
  // - Merged LAB cells using blockId (colSpan)
  // - Lunch column with vertical text (rowSpan)
  // -------------------------
  function renderRowCellsForSection(secName: string, day: number) {
    const dayMap = bySectionName[secName]?.[day] || {};
    const cells: React.ReactNode[] = [];

    // Pre-lunch P1..P3
    let i = 0;
    while (i < PRE_LUNCH.length) {
      const p = PRE_LUNCH[i];
      const e = dayMap[p];
      if (e?.blockId) {
        let span = 1;
        while (i + span < PRE_LUNCH.length) {
          const nextP = PRE_LUNCH[i + span];
          const nextE = dayMap[nextP];
          if (!nextE || nextE.blockId !== e.blockId) break;
          span++;
        }
        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border" colSpan={span}>
            {cellTextForSection(e)}
          </td>
        );
        i += span;
      } else {
        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border">
            {cellTextForSection(e)}
          </td>
        );
        i++;
      }
    }

    // Lunch column (merged rows)
    if (day === 1) {
      cells.push(
        <td
          key="lunch"
          rowSpan={Object.keys(DAYS).length}
          className="p-2 text-center border-l border-border bg-muted/30"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          Lunch
        </td>
      );
    }

    // Post-lunch P4..P6
    i = 0;
    while (i < POST_LUNCH.length) {
      const p = POST_LUNCH[i];
      const e = dayMap[p];
      if (e?.blockId) {
        let span = 1;
        while (i + span < POST_LUNCH.length) {
          const nextP = POST_LUNCH[i + span];
          const nextE = dayMap[nextP];
          if (!nextE || nextE.blockId !== e.blockId) break;
          span++;
        }
        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border" colSpan={span}>
            {cellTextForSection(e)}
          </td>
        );
        i += span;
      } else {
        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border">
            {cellTextForSection(e)}
          </td>
        );
        i++;
      }
    }

    return cells;
  }

  function renderRowCellsForFaculty(facName: string, day: number) {
    const dayMap = byFacultyName[facName]?.[day] || {};
    const cells: React.ReactNode[] = [];

    // For merging, only merge if exactly one entry and blockId matches across periods.
    const singleEntryAt = (p: number) => {
      const list = dayMap[p] || [];
      return list.length === 1 ? list[0] : null;
    };

    // Pre-lunch
    let i = 0;
    while (i < PRE_LUNCH.length) {
      const p = PRE_LUNCH[i];
      const list = dayMap[p] || [];
      const one = singleEntryAt(p);

      if (one?.blockId) {
        let span = 1;
        while (i + span < PRE_LUNCH.length) {
          const nextP = PRE_LUNCH[i + span];
          const nextOne = singleEntryAt(nextP);
          if (!nextOne || nextOne.blockId !== one.blockId) break;
          span++;
        }

        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border" colSpan={span}>
            {cellTextForFaculty(one)}
          </td>
        );
        i += span;
      } else {
        const text = list.map((e) => cellTextForFaculty(e)).join(", ");
        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border">
            {text}
          </td>
        );
        i++;
      }
    }

    // Lunch column (merged rows)
    if (day === 1) {
      cells.push(
        <td
          key="lunch"
          rowSpan={Object.keys(DAYS).length}
          className="p-2 text-center border-l border-border bg-muted/30"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          Lunch
        </td>
      );
    }

    // Post-lunch
    i = 0;
    while (i < POST_LUNCH.length) {
      const p = POST_LUNCH[i];
      const list = dayMap[p] || [];
      const one = singleEntryAt(p);

      if (one?.blockId) {
        let span = 1;
        while (i + span < POST_LUNCH.length) {
          const nextP = POST_LUNCH[i + span];
          const nextOne = singleEntryAt(nextP);
          if (!nextOne || nextOne.blockId !== one.blockId) break;
          span++;
        }

        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border" colSpan={span}>
            {cellTextForFaculty(one)}
          </td>
        );
        i += span;
      } else {
        const text = list.map((e) => cellTextForFaculty(e)).join(", ");
        cells.push(
          <td key={`p${p}`} className="p-2 align-top border-l border-border">
            {text}
          </td>
        );
        i++;
      }
    }

    return cells;
  }

  const facultyFilterNote =
    layoutMode === "FACULTY" && selectedDeptId
      ? `Showing faculty only for ${selectedDepartment?.name}.`
      : null;

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Timetable Viewer</h1>
          <p className="page-description">View and download the generated timetable</p>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={handleDownloadPdf}
          disabled={!selectedTimetableId}
        >
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>

      {/* Top selectors */}
      <div className="card-soft p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <BatchSelector />
          <SemesterSelector />

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={layoutMode === "SECTION" ? "default" : "outline"}
              onClick={() => setLayoutMode("SECTION")}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Section
            </Button>
            <Button
              variant={layoutMode === "FACULTY" ? "default" : "outline"}
              onClick={() => setLayoutMode("FACULTY")}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Faculty
            </Button>

            {layoutMode === "FACULTY" && (
  <div className="relative ml-2">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <input
      className="h-10 w-56 rounded-md border border-input bg-background px-3 pl-9 text-sm"
      placeholder="Search..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>
)}

          </div>
        </div>

        {facultyFilterNote && (
          <div className="mt-2 text-xs text-muted-foreground">{facultyFilterNote}</div>
        )}

        {nothingMatches && (
          <div className="mt-3 text-sm text-destructive">No results match “{search}”.</div>
        )}
      </div>

      {!selectedTimetableId ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          No ACTIVE timetable found for this semester. Generate one first.
        </div>
      ) : loading ? (
        <div className="card-soft p-10 text-center text-muted-foreground">Loading timetable...</div>
      ) : entries.length === 0 ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          No entries found. Generate timetable again.
        </div>
      ) : (
        <div className="space-y-6">
          {layoutMode === "SECTION" ? (
            sectionNamesToRender.map((secName) => (
              <StatusCard
                key={secName}
                title={`Section ${secName}`}
                icon={<Calendar className="w-4 h-4" />}
              >
                <div className="overflow-auto">
                  <table className="min-w-[900px] w-full text-sm border border-border">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left p-2 border-b border-border">Day</th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P1
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P2
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P3
                        </th>
                        <th className="text-center p-2 border-b border-border border-l border-border">
                          Lunch
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P4
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P5
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P6
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(DAYS).map((d) => {
                        const day = Number(d);
                        return (
                          <tr key={day} className="border-b border-border">
                            <td className="p-2 font-medium">{DAYS[day]}</td>
                            {renderRowCellsForSection(secName, day)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </StatusCard>
            ))
          ) : (
            facultyNamesToRender.map((facName) => (
              <StatusCard
                key={facName}
                title={facName}
                icon={<Calendar className="w-4 h-4" />}
              >
                <div className="overflow-auto">
                  <table className="min-w-[900px] w-full text-sm border border-border">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left p-2 border-b border-border">Day</th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P1
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P2
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P3
                        </th>
                        <th className="text-center p-2 border-b border-border border-l border-border">
                          Lunch
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P4
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P5
                        </th>
                        <th className="text-left p-2 border-b border-border border-l border-border">
                          P6
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(DAYS).map((d) => {
                        const day = Number(d);
                        return (
                          <tr key={day} className="border-b border-border">
                            <td className="p-2 font-medium">{DAYS[day]}</td>
                            {renderRowCellsForFaculty(facName, day)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </StatusCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}
