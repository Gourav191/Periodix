// src/lib/api.ts
const rawApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE = (rawApiBase || "http://localhost:3001").replace(/\/+$/, "");

export type ApiResult<T> = { data?: T; error?: string };

// --------------------
// Auth token helpers
// --------------------
const TOKEN_KEY = "periodix_token";

export function setAuthToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --------------------
// Requests
// --------------------
async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) setAuthToken(null);
      return { error: json?.error || `Request failed (${res.status})` };
    }

    return { data: json as T };
  } catch (err: any) {
    return { error: err?.message || "Network error" };
  }
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<ApiResult<Blob>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      if (res.status === 401) setAuthToken(null);

      // Try parse JSON error, otherwise fallback
      const text = await res.text().catch(() => "");
      try {
        const maybeJson = text ? JSON.parse(text) : null;
        return { error: maybeJson?.error || `Request failed (${res.status})` };
      } catch {
        return { error: text || `Request failed (${res.status})` };
      }
    }

    const blob = await res.blob();
    return { data: blob };
  } catch (err: any) {
    return { error: err?.message || "Network error" };
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --------------------
// Auth types + APIs
// --------------------
export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export async function login(
  email: string,
  password: string
): Promise<ApiResult<{ token: string; user: AuthUser }>> {
  const res = await request<{ ok: boolean; token: string; user: AuthUser }>(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (res.error) return { error: res.error };
  return { data: { token: res.data!.token, user: res.data!.user } };
}

export async function me(): Promise<ApiResult<AuthUser>> {
  const res = await request<{ ok: boolean; user: AuthUser }>(`/api/auth/me`, { method: "GET" });
  if (res.error) return { error: res.error };
  return { data: res.data!.user };
}

// --------------------
// Users (Admin-only UI calls)
// Backend should protect these routes using requireAuth + requireRole("ADMIN")
// --------------------
export interface UserRow extends AuthUser {
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function listUsers(): Promise<ApiResult<UserRow[]>> {
  const res = await request<{ ok: boolean; users: UserRow[] }>("/api/users");
  if (res.error) return { error: res.error };
  return { data: res.data?.users || [] };
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<ApiResult<UserRow>> {
  const res = await request<{ ok: boolean; user: UserRow }>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.error) return { error: res.error };
  return { data: res.data?.user };
}

export async function updateUser(
  id: string,
  payload: Partial<{ name: string; role: Role; isActive: boolean; password: string }>
): Promise<ApiResult<UserRow>> {
  const res = await request<{ ok: boolean; user: UserRow }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.error) return { error: res.error };
  return { data: res.data?.user };
}

// --------------------
// Faculty load (for preview in Assignments UI)
// --------------------
export async function getFacultyLoad(semesterId: string): Promise<ApiResult<Record<string, number>>> {
  const res = await request<{ ok: boolean; load: Record<string, number> }>(
    `/api/semesters/${semesterId}/faculty-load`
  );
  if (res.error) return { error: res.error };
  return { data: res.data?.load || {} };
}

// --------------------
// Domain types
// --------------------
export interface Department {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Section {
  id: string;
  batchId: string;
  sectionIndex: number;
  name: string;
  createdAt?: string;
}

export interface Semester {
  id: string;
  batchId: string;
  semesterNo: number;

  daysPerWeek?: number;
  periodsPerDay?: number;
  periodDurationMins?: number;
  dayStartTime?: string;
  lunchStartTime?: string;
  lunchEndTime?: string;

  createdAt?: string;
}

export interface Batch {
  id: string;
  program?: string | null;
  departmentId: string;
  startYear: number;
  endYear: number;
  durationYears: number;
  sectionsCount: number;
  createdAt?: string;

  department?: Department;
  sections?: Section[];
  semesters?: Semester[];
}

export interface Faculty {
  id: string;
  name: string;
  departmentId: string;
  maxHoursPerWeek: number;
  isActive?: boolean;
  createdAt?: string;

  department?: Department;
}

export type SubjectType = "THEORY" | "LAB" | "NON_CREDIT";

export interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code?: string | null;
  type: SubjectType;
  labDurationHours?: number | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface TeachingAssignmentFacultyLink {
  id: string;
  assignmentId: string;
  facultyId: string;
  faculty?: Faculty;
}

export interface TeachingAssignment {
  id: string;
  semesterId: string;
  sectionId: string;
  subjectId: string;

  section?: Section;
  subject?: Subject;
  faculties?: TeachingAssignmentFacultyLink[];
}

export interface Timetable {
  id: string;
  semesterId: string;
  versionNo: number;
  status: "ACTIVE" | "INACTIVE";
  createdBy?: string | null;
  createdAt?: string;
}

export interface TimetableEntryFacultyLink {
  id: string;
  timetableEntryId: string;
  facultyId: string;
  faculty?: Faculty;
}

export interface TimetableEntry {
  id: string;
  timetableId: string;
  sectionId: string;
  subjectId: string;
  dayOfWeek: number; // 1=Mon ... 6=Sat
  periodNo: number; // 1..6
  blockId?: string | null;

  section?: Section;
  subject?: Subject;
  faculties?: TimetableEntryFacultyLink[];
}

export interface GenerateResult {
  timetableId: string;
  warnings: string[];
  facultyHours: Record<string, number>;
  insertedEntries: number;
}

// --------------------
// Departments
// --------------------
export async function getDepartments(): Promise<ApiResult<Department[]>> {
  const res = await request<{ ok: boolean; departments: Department[] }>(`/api/departments`);
  if (res.error) return { error: res.error };
  return { data: res.data?.departments || [] };
}

export async function createDepartment(payload: { name: string }): Promise<ApiResult<Department>> {
  const res = await request<{ ok: boolean; department: Department }>(`/api/departments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.error) return { error: res.error };
  return { data: res.data?.department };
}

// --------------------
// Batches
// --------------------
export async function getBatches(): Promise<ApiResult<Batch[]>> {
  const res = await request<{ ok: boolean; batches: Batch[] }>("/api/batches");
  if (res.error) return { error: res.error };
  return { data: res.data?.batches || [] };
}

export async function createBatch(payload: {
  program: string;
  departmentId: string;
  startYear: number;
  durationYears: number;
  sectionsCount: number;
}): Promise<ApiResult<Batch>> {
  const res = await request<{ ok: boolean; batch: Batch }>("/api/batches", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (res.error) return { error: res.error };
  return { data: res.data?.batch };
}

// --------------------
// Faculty
// --------------------
export async function getFaculty(departmentId?: string): Promise<ApiResult<Faculty[]>> {
  const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
  const res = await request<{ ok: boolean; faculty: Faculty[] }>(`/api/faculty${q}`);
  if (res.error) return { error: res.error };
  return { data: res.data?.faculty || [] };
}

export async function updateFaculty(
  id: string,
  payload: Partial<{ name: string; departmentId: string; maxHoursPerWeek: number }>
): Promise<ApiResult<Faculty>> {
  const res = await request<{ ok: boolean; faculty: Faculty }>(`/api/faculty/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.error) return { error: res.error };
  return { data: res.data?.faculty };
}

export async function deleteFaculty(id: string): Promise<ApiResult<true>> {
  const res = await request<{ ok: boolean }>(`/api/faculty/${id}`, {
    method: "DELETE",
  });
  if (res.error) return { error: res.error };
  return { data: true };
}


export async function createFaculty(payload: {
  name: string;
  departmentId: string;
  maxHoursPerWeek?: number;
}): Promise<ApiResult<Faculty>> {
  const res = await request<{ ok: boolean; faculty: Faculty }>("/api/faculty", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (res.error) return { error: res.error };
  return { data: res.data?.faculty };
}

// --------------------
// Subjects (semester-wise)
// --------------------
export async function getSubjects(semesterId: string): Promise<ApiResult<Subject[]>> {
  const res = await request<{ ok: boolean; subjects: Subject[] }>(
    `/api/semesters/${semesterId}/subjects`
  );
  if (res.error) return { error: res.error };
  return { data: res.data?.subjects || [] };
}

export async function createSubject(
  semesterId: string,
  payload: { name: string; code?: string; type: SubjectType; labDurationHours?: number }
): Promise<ApiResult<Subject>> {
  const res = await request<{ ok: boolean; subject: Subject }>(
    `/api/semesters/${semesterId}/subjects`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  if (res.error) return { error: res.error };
  return { data: res.data?.subject };
}

// --------------------
// Teaching Assignments
// --------------------
export async function getAssignments(semesterId: string): Promise<ApiResult<TeachingAssignment[]>> {
  const res = await request<{ ok: boolean; assignments: TeachingAssignment[] }>(
    `/api/semesters/${semesterId}/assignments`
  );
  if (res.error) return { error: res.error };
  return { data: res.data?.assignments || [] };
}

export async function createAssignment(
  semesterId: string,
  payload: { sectionId: string; subjectId: string; facultyIds: string[] }
): Promise<ApiResult<any>> {
  const res = await request<any>(`/api/semesters/${semesterId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (res.error) return { error: res.error };
  return { data: res.data };
}

export async function deleteAssignment(assignmentId: string): Promise<ApiResult<true>> {
  const res = await request<{ ok: boolean }>(`/api/assignments/${assignmentId}`, {
    method: "DELETE",
  });

  if (res.error) return { error: res.error };
  return { data: true };
}

// --------------------
// Timetables
// --------------------
export async function generateTimetable(
  semesterId: string,
  createdBy = "admin"
): Promise<ApiResult<GenerateResult>> {
  const res = await request<{
    ok: boolean;
    timetable: Timetable;
    warnings: string[];
    facultyHours?: Record<string, number>;
    insertedEntries?: number;
  }>(`/api/semesters/${semesterId}/timetables/generate`, {
    method: "POST",
    body: JSON.stringify({ createdBy }),
  });

  if (res.error) return { error: res.error };

  return {
    data: {
      timetableId: res.data!.timetable.id,
      warnings: res.data!.warnings || [],
      facultyHours: res.data!.facultyHours || {},
      insertedEntries: res.data!.insertedEntries || 0,
    },
  };
}

export async function getActiveTimetable(semesterId: string): Promise<ApiResult<Timetable | null>> {
  const res = await request<{ ok: boolean; timetable: Timetable | null }>(
    `/api/semesters/${semesterId}/timetables/active`
  );
  if (res.error) return { error: res.error };
  return { data: res.data?.timetable ?? null };
}

export async function getTimetableEntries(
  timetableId: string
): Promise<ApiResult<TimetableEntry[]>> {
  const res = await request<{ ok: boolean; entries: TimetableEntry[] }>(
    `/api/timetables/${timetableId}/entries`
  );
  if (res.error) return { error: res.error };
  return { data: res.data?.entries || [] };
}

export async function downloadTimetablePdf(timetableId: string): Promise<ApiResult<Blob>> {
  return requestBlob(`/api/timetables/${timetableId}/pdf`, { method: "GET" });
}


