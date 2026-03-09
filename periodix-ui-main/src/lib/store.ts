import { create } from "zustand";
import type {
  AuthUser,
  Batch,
  Department,
  Faculty,
  GenerateResult,
  Semester,
  Section,
} from "./api";
import { setAuthToken } from "./api";

type AppState = {
  // --------------------
  // Auth
  // --------------------
  authUser: AuthUser | null;
  setAuthUser: (u: AuthUser | null) => void;
  logout: () => void;

  isAdmin: () => boolean;
  canEditDepartmentsBatches: () => boolean;

  // --------------------
  // master data
  // --------------------
  departments: Department[];
  batches: Batch[];
  faculty: Faculty[];

  // selections
  selectedBatchId: string | null;
  selectedSemesterId: string | null;
  selectedSectionId: string | null;
  selectedTimetableId: string | null;

  // last generation output
  lastGenerateResult: GenerateResult | null;

  // setters
  setDepartments: (departments: Department[]) => void;
  setBatches: (batches: Batch[]) => void;
  setFaculty: (faculty: Faculty[]) => void;

  setSelectedBatchId: (id: string | null) => void;
  setSelectedSemesterId: (id: string | null) => void;
  setSelectedSectionId: (id: string | null) => void;
  setSelectedTimetableId: (id: string | null) => void;

  setLastGenerateResult: (r: GenerateResult | null) => void;

  // helpers
  getSelectedBatch: () => Batch | undefined;
  getSelectedSemester: () => Semester | undefined;
  getSelectedSection: () => Section | undefined;
  getSelectedDepartment: () => Department | undefined;
};

export const useAppStore = create<AppState>((set, get) => ({
  // --------------------
  // Auth
  // --------------------
  authUser: null,
  setAuthUser: (u) => set({ authUser: u }),
  logout: () => {
    setAuthToken(null);
    set({ authUser: null });
  },

  isAdmin: () => get().authUser?.role === "ADMIN",
  canEditDepartmentsBatches: () => get().authUser?.role === "ADMIN",

  // --------------------
  // Data
  // --------------------
  departments: [],
  batches: [],
  faculty: [],

  selectedBatchId: null,
  selectedSemesterId: null,
  selectedSectionId: null,
  selectedTimetableId: null,

  lastGenerateResult: null,

  setDepartments: (departments) => set({ departments }),
  setBatches: (batches) => set({ batches }),
  setFaculty: (faculty) => set({ faculty }),

  setSelectedBatchId: (id) =>
    set({
      selectedBatchId: id,
      // reset dependent selections
      selectedSemesterId: null,
      selectedSectionId: null,
      selectedTimetableId: null,
      lastGenerateResult: null,
    }),

  setSelectedSemesterId: (id) =>
    set({
      selectedSemesterId: id,
      // reset dependent selections
      selectedSectionId: null,
      selectedTimetableId: null,
      lastGenerateResult: null,
    }),

  setSelectedSectionId: (id) => set({ selectedSectionId: id }),
  setSelectedTimetableId: (id) => set({ selectedTimetableId: id }),
  setLastGenerateResult: (r) => set({ lastGenerateResult: r }),

  getSelectedBatch: () => {
    const { batches, selectedBatchId } = get();
    return batches.find((b) => b.id === selectedBatchId);
  },

  getSelectedSemester: () => {
    const batch = get().getSelectedBatch();
    const semId = get().selectedSemesterId;
    return batch?.semesters?.find((s) => s.id === semId);
  },

  getSelectedSection: () => {
    const batch = get().getSelectedBatch();
    const secId = get().selectedSectionId;
    return batch?.sections?.find((s) => s.id === secId);
  },

  getSelectedDepartment: () => {
    const batch = get().getSelectedBatch();
    if (!batch?.departmentId) return undefined;
    const { departments } = get();
    return departments.find((d) => d.id === batch.departmentId) || batch.department;
  },
}));
