// src/pages/Faculty.tsx
import { useState, useEffect, useMemo } from "react";
import { Plus, Users, Search, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusCard } from "@/components/StatusCard";
import { DataTable } from "@/components/DataTable";
import { LoadingSpinner, LoadingState } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import {
  createFaculty,
  getDepartments,
  getFaculty,
  getActiveTimetable,
  getTimetableEntries,
  updateFaculty,
  deleteFaculty,
  type Department,
  type Faculty,
  type TimetableEntry,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ✅ Popup modal (shadcn)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function FacultyPage() {
  const { toast } = useToast();

  const {
    authUser,
    faculty,
    setFaculty,
    departments,
    setDepartments,
    selectedSemesterId,
  } = useAppStore();

  // ✅ rules you asked:
  // - delete: ADMIN or EDITOR
  // - edit: ADMIN only (change if you want)
  const canEdit = authUser?.role === "ADMIN";
  const canDelete = authUser?.role === "ADMIN" || authUser?.role === "EDITOR";
  const canAdd = authUser?.role !== "VIEWER"; // viewers cannot add

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Department filter for list
  const [deptFilterId, setDeptFilterId] = useState<string>("ALL");

  // facultyId -> used hours
  const [loadMap, setLoadMap] = useState<Record<string, number>>({});

  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    maxHoursPerWeek: 16,
  });

  // ✅ Edit Dialog State
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    departmentId: "",
    maxHoursPerWeek: 16,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [deptRes, facRes] = await Promise.all([getDepartments(), getFaculty()]);
      if (cancelled) return;

      if (deptRes.data) setDepartments(deptRes.data);
      if (facRes.data) setFaculty(facRes.data);

      setLoading(false);
    }

    load().catch((e) => {
      toast({
        title: "Failed to load faculty/departments",
        description: e?.message || "Backend not reachable",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [setDepartments, setFaculty, toast]);

  // Load ACTIVE timetable entries for selected semester -> compute used hours per faculty
  useEffect(() => {
    let cancelled = false;

    async function loadFacultyUsage() {
      if (!selectedSemesterId) {
        setLoadMap({});
        return;
      }

      const activeRes = await getActiveTimetable(selectedSemesterId);
      if (cancelled) return;

      const activeId = activeRes.data?.id;
      if (!activeId) {
        setLoadMap({});
        return;
      }

      const entriesRes = await getTimetableEntries(activeId);
      if (cancelled) return;

      const entries = (entriesRes.data || []) as TimetableEntry[];

      const used: Record<string, number> = {};
      for (const e of entries) {
        const facIds = (e.faculties || [])
          .map((x) => x.facultyId)
          .filter(Boolean) as string[];
        for (const fid of facIds) used[fid] = (used[fid] || 0) + 1;
      }

      setLoadMap(used);
    }

    loadFacultyUsage().catch(() => setLoadMap({}));

    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId]);

  const deptMap = useMemo(() => {
    const m = new Map<string, Department>();
    for (const d of departments) m.set(d.id, d);
    return m;
  }, [departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAdd) {
      toast({
        title: "Not allowed",
        description: "Viewers cannot add faculty.",
        variant: "destructive",
      });
      return;
    }

    if (!form.departmentId) {
      toast({
        title: "Department required",
        description: "Select a department for the faculty.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const result = await createFaculty(form);

    if (result.error) {
      toast({
        title: "Error adding faculty",
        description: result.error,
        variant: "destructive",
      });
    } else if (result.data) {
      toast({ title: "Faculty added successfully" });
      setFaculty([...faculty, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: "", departmentId: "", maxHoursPerWeek: 16 });
    }

    setSubmitting(false);
  };

  const filteredFaculty = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return faculty.filter((f) => {
      const matchesSearch = !q || f.name.toLowerCase().includes(q);

      const matchesDept =
        deptFilterId === "ALL" || !deptFilterId ? true : f.departmentId === deptFilterId;

      return matchesSearch && matchesDept;
    });
  }, [faculty, searchQuery, deptFilterId]);

  function openEdit(item: Faculty) {
    if (!canEdit) {
      toast({
        title: "Not allowed",
        description: "Only admins can edit faculty.",
        variant: "destructive",
      });
      return;
    }

    setEditing(item);
    setEditForm({
      name: item.name || "",
      departmentId: item.departmentId || "",
      maxHoursPerWeek: item.maxHoursPerWeek ?? 16,
    });
  }

  async function saveEdit() {
    if (!editing) return;

    if (!editForm.departmentId) {
      toast({ title: "Department required", variant: "destructive" });
      return;
    }

    setSavingEdit(true);
    const res = await updateFaculty(editing.id, {
      name: editForm.name,
      departmentId: editForm.departmentId,
      maxHoursPerWeek: Number(editForm.maxHoursPerWeek),
    });

    if (res.error) {
      toast({ title: "Update failed", description: res.error, variant: "destructive" });
      setSavingEdit(false);
      return;
    }

    const updated = res.data!;
    setFaculty(
      faculty
        .map((f) => (f.id === updated.id ? updated : f))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    toast({ title: "Faculty updated" });
    setEditing(null);
    setSavingEdit(false);
  }

  async function handleDelete(item: Faculty) {
    if (!canDelete) {
      toast({
        title: "Not allowed",
        description: "Only admins/editors can delete faculty.",
        variant: "destructive",
      });
      return;
    }

    const ok = window.confirm(`Delete faculty "${item.name}"?`);
    if (!ok) return;

    setDeletingId(item.id);
    const res = await deleteFaculty(item.id);

    if (res.error) {
      toast({ title: "Delete failed", description: res.error, variant: "destructive" });
      setDeletingId(null);
      return;
    }

    setFaculty(faculty.filter((f) => f.id !== item.id));
    toast({ title: "Faculty deleted" });
    setDeletingId(null);
  }

  const editingDeptLabel =
    editing?.department?.name ||
    (editing?.departmentId ? deptMap.get(editing.departmentId)?.name : "") ||
    "—";

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Faculty</h1>
        <p className="page-description">Manage faculty members, departments, and weekly hours</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Faculty Form */}
        <StatusCard title="Add Faculty" icon={<Plus className="w-4 h-4" />}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Dr. John Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={!canAdd}
              />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => setForm({ ...form, departmentId: v })}
                disabled={!canAdd}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Faculty will only show in Assignments for batches of the same department.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxHours">Max Hours/Week</Label>
              <Input
                id="maxHours"
                type="number"
                min={1}
                max={40}
                value={form.maxHoursPerWeek}
                onChange={(e) =>
                  setForm({ ...form, maxHoursPerWeek: parseInt(e.target.value || "16") })
                }
                required
                disabled={!canAdd}
              />
            </div>

            <Button type="submit" disabled={submitting || !canAdd} className="w-full">
              {submitting ? <LoadingSpinner size="sm" /> : "Add Faculty"}
            </Button>

            {!canAdd && (
              <p className="text-xs text-muted-foreground">
                Viewers cannot add/edit/delete faculty.
              </p>
            )}
          </form>
        </StatusCard>

        {/* Faculty List */}
        <div className="md:col-span-2">
          <StatusCard
            title="Faculty List"
            icon={<Users className="w-4 h-4" />}
            actions={
              <div className="flex items-center gap-2">
                {/* Department filter */}
                <Select value={deptFilterId} onValueChange={setDeptFilterId}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Filter Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
              </div>
            }
          >
            {loading ? (
              <LoadingState message="Loading faculty..." />
            ) : (
              <>
                <DataTable
                  data={filteredFaculty}
                  columns={[
                    { key: "name", header: "Name" },
                    {
                      key: "departmentId",
                      header: "Department",
                      render: (item) => (
                        <span className="text-muted-foreground inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {item.department?.name || deptMap.get(item.departmentId)?.name || "—"}
                        </span>
                      ),
                    },
                    {
                      key: "usedHours",
                      header: "Current Load",
                      render: (item) => {
                        const used = loadMap[item.id];
                        return (
                          <span className="text-muted-foreground">
                            {typeof used === "number" ? `${used}h` : "—"}
                          </span>
                        );
                      },
                    },
                    {
                      key: "maxHoursPerWeek",
                      header: "Max Hours/Week",
                      render: (item) => (
                        <span className="text-muted-foreground">{item.maxHoursPerWeek}h</span>
                      ),
                    },

                    // ✅ Actions column: pen + bin
                    {
                      key: "actions",
                      header: "",
                      className: "text-right w-[88px]",
                      render: (item) => {
                        const disabledDel = deletingId === item.id;

                        if (!canEdit && !canDelete) {
                          return <span className="text-xs text-muted-foreground">—</span>;
                        }

                        return (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(item)}
                              disabled={!canEdit}
                              title={canEdit ? "Edit" : "Only admins can edit"}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              disabled={!canDelete || disabledDel}
                              title={canDelete ? "Delete" : "Not allowed"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      },
                    },
                  ]}
                  emptyMessage="No faculty found"
                />

                {/* ✅ Popup Edit Dialog */}
                <Dialog
                  open={!!editing}
                  onOpenChange={(open) => {
                    if (!open) setEditing(null);
                  }}
                >
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Edit Faculty</DialogTitle>
                      <DialogDescription className="text-xs">
                        {editingDeptLabel}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select
                          value={editForm.departmentId}
                          onValueChange={(v) =>
                            setEditForm({ ...editForm, departmentId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Max Hours/Week</Label>
                        <Input
                          type="number"
                          min={1}
                          max={40}
                          value={editForm.maxHoursPerWeek}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              maxHoursPerWeek: parseInt(e.target.value || "16"),
                            })
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button onClick={saveEdit} disabled={savingEdit}>
                        {savingEdit ? "Saving..." : "Save"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </StatusCard>
        </div>
      </div>
    </div>
  );
}
