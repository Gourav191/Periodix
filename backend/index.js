// backend/index.js
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const puppeteer = require("puppeteer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());


// --------------------
// Auth config
// --------------------
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY = "7d";

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function getTokenFromReq(req) {
  const h = req.headers.authorization || "";
  const parts = h.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!roles.includes(role)) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    next();
  };
}



// --------------------
// Health check
// --------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Backend running" });
});

// --------------------
// Auth APIs
// --------------------

// Create first admin if none exists (dev helper)
app.post("/api/auth/bootstrap-admin", async (req, res) => {
  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      return res.status(400).json({ ok: false, error: "Admin already exists" });
    }

    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: "name, email, password required" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: { name: String(name), email: String(email).toLowerCase(), passwordHash, role: "ADMIN" },
    });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = signToken(user);
    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const u = req.user;
  res.json({ ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

// --------------------
// Admin: User management APIs
// --------------------
const ALLOWED_ROLES = ["ADMIN", "EDITOR", "VIEWER"];

app.get("/api/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    res.json({ ok: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, email, password, role = "VIEWER" } = req.body || {};
    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanName = String(name || "").trim();

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ ok: false, error: "name, email, password required" });
    }
    if (!ALLOWED_ROLES.includes(String(role))) {
      return res.status(400).json({ ok: false, error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role: String(role),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });

    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    // unique email
    if (String(err.message || "").toLowerCase().includes("unique")) {
      return res.status(400).json({ ok: false, error: "Email already exists" });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch("/api/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body || {};

    // prevent admin disabling themselves
    if (req.user?.id === id && isActive === false) {
      return res.status(400).json({ ok: false, error: "You cannot deactivate your own account." });
    }

    const data = {};

    if (name !== undefined) {
      const cleanName = String(name || "").trim();
      if (!cleanName) return res.status(400).json({ ok: false, error: "name cannot be empty" });
      data.name = cleanName;
    }

    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(String(role))) {
        return res.status(400).json({ ok: false, error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
      }
      data.role = String(role);
    }

    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    if (password !== undefined && String(password).trim()) {
      data.passwordHash = await bcrypt.hash(String(password), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });

    res.json({ ok: true, user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});



// --------------------
// Department APIs
// --------------------
app.get("/api/departments", async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ ok: true, departments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/departments", requireAuth, requireRole("ADMIN"), async (req, res) => {

  try {
    const name = (req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: "Department name is required" });
    }

    // Upsert by unique name (nice UX for “create if not exists”)
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    res.json({ ok: true, department: dept });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------
// Batch APIs
// - Branch renamed to Department (stored as Department relation)
// --------------------
app.post("/api/batches", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { program, departmentId, departmentName, startYear, sectionsCount, durationYears = 4 } =
      req.body || {};

    if (!startYear || !sectionsCount) {
      return res.status(400).json({
        ok: false,
        error: "startYear and sectionsCount are required",
      });
    }

    // Allow frontend to either pass departmentId OR departmentName (create if needed)
    let deptId = departmentId;
    if (!deptId) {
      const name = (departmentName || "").trim();
      if (!name) {
        return res.status(400).json({
          ok: false,
          error: "departmentId or departmentName is required",
        });
      }
      const dept = await prisma.department.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      deptId = dept.id;
    } else {
      const exists = await prisma.department.findUnique({ where: { id: deptId } });
      if (!exists) {
        return res.status(400).json({ ok: false, error: "Invalid departmentId" });
      }
    }

    const endYear = Number(startYear) + Number(durationYears);

    const batch = await prisma.batch.create({
      data: {
        program,
        departmentId: deptId,
        startYear: Number(startYear),
        endYear,
        durationYears: Number(durationYears),
        sectionsCount: Number(sectionsCount),
        sections: {
          create: Array.from({ length: Number(sectionsCount) }).map((_, i) => ({
            sectionIndex: i + 1,
            name: String.fromCharCode(65 + i), // A, B, C...
          })),
        },
        semesters: {
          create: Array.from({ length: Number(durationYears) * 2 }).map((_, i) => ({
            semesterNo: i + 1,
          })),
        },
      },
      include: {
        department: true,
        sections: true,
        semesters: true,
      },
    });

    res.json({ ok: true, batch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/batches", async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      include: {
        department: true,
        sections: { orderBy: { sectionIndex: "asc" } },
        semesters: { orderBy: { semesterNo: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, batches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------
// Faculty APIs
// - Faculty must belong to a Department
// - Supports filtering by departmentId
// --------------------
app.post("/api/faculty", requireAuth, requireRole("ADMIN", "EDITOR"), async (req, res) => {
  try {
    const { name, departmentId, maxHoursPerWeek = 16 } = req.body || {};
    if (!name || !departmentId) {
      return res.status(400).json({
        ok: false,
        error: "name and departmentId are required",
      });
    }

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      return res.status(400).json({ ok: false, error: "Invalid departmentId" });
    }

    const faculty = await prisma.faculty.create({
      data: { name, departmentId, maxHoursPerWeek: Number(maxHoursPerWeek) },
      include: { department: true },
    });

    res.json({ ok: true, faculty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.get("/api/faculty", requireAuth, async (req, res) => {
  try {
    const departmentId = req.query?.departmentId ? String(req.query.departmentId) : null;

    const faculty = await prisma.faculty.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      include: { department: true },
      orderBy: { name: "asc" },
    });

    res.json({ ok: true, faculty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch("/api/faculty/:id", requireAuth, requireRole("ADMIN", "EDITOR"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, departmentId, maxHoursPerWeek } = req.body || {};

    const data = {};

    if (name !== undefined) {
      const cleanName = String(name || "").trim();
      if (!cleanName) return res.status(400).json({ ok: false, error: "name cannot be empty" });
      data.name = cleanName;
    }

    if (departmentId !== undefined) {
      const dept = await prisma.department.findUnique({ where: { id: String(departmentId) } });
      if (!dept) return res.status(400).json({ ok: false, error: "Invalid departmentId" });
      data.departmentId = String(departmentId);
    }

    if (maxHoursPerWeek !== undefined) {
      data.maxHoursPerWeek = Number(maxHoursPerWeek);
    }

    const faculty = await prisma.faculty.update({
      where: { id },
      data,
      include: { department: true },
    });

    res.json({ ok: true, faculty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete("/api/faculty/:id", requireAuth, requireRole("ADMIN", "EDITOR"), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.faculty.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// --------------------
// Subject APIs (Semester-wise)
// --------------------
app.post("/api/semesters/:semesterId/subjects", async (req, res) => {
  try {
    const { semesterId } = req.params;
    const { name, code, type, labDurationHours } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        ok: false,
        error: "Subject name and type are required",
      });
    }

    const allowed = ["THEORY", "LAB", "NON_CREDIT"];
    if (!allowed.includes(type)) {
      return res.status(400).json({
        ok: false,
        error: `type must be one of: ${allowed.join(", ")}`,
      });
    }

    if (type === "LAB" && ![2, 3].includes(labDurationHours)) {
      return res.status(400).json({
        ok: false,
        error: "Lab duration must be 2 or 3 hours",
      });
    }

    if (type !== "LAB" && labDurationHours) {
      return res.status(400).json({
        ok: false,
        error: "Only LAB subjects can have labDurationHours",
      });
    }

    const subject = await prisma.subject.create({
      data: {
        semesterId,
        name,
        code,
        type,
        labDurationHours: type === "LAB" ? labDurationHours : null,
      },
    });

    res.json({ ok: true, subject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/semesters/:semesterId/subjects", async (req, res) => {
  try {
    const { semesterId } = req.params;

    const subjects = await prisma.subject.findMany({
      where: { semesterId, isActive: true },
      orderBy: { name: "asc" },
    });

    res.json({ ok: true, subjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------
// Teaching Assignment APIs
// - One subject per section (unique) ✅
// - THEORY/NON_CREDIT: exactly 1 faculty ✅
// - LAB: 1..3 faculties ✅
// - Replace faculties if assignment already exists ✅
// - Returns warning if any selected faculty exceeds weekly load ✅
// --------------------
function normalizeFacultyIds(input) {
  const arr = Array.isArray(input) ? input : input ? [input] : [];
  const uniq = [];
  const seen = new Set();
  for (const x of arr) {
    const v = String(x || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    uniq.push(v);
  }
  return uniq;
}

app.post("/api/semesters/:semesterId/assignments", async (req, res) => {
  try {
    const { semesterId } = req.params;
    const { sectionId, subjectId, facultyId, facultyIds } = req.body || {};

    if (!sectionId || !subjectId) {
      return res.status(400).json({
        ok: false,
        error: "sectionId and subjectId are required",
      });
    }

    const ids = normalizeFacultyIds(facultyIds || facultyId);

    // Validate subject belongs to semester
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.semesterId !== semesterId) {
      return res.status(400).json({
        ok: false,
        error: "subjectId does not belong to this semester",
      });
    }

    // Enforce counts
    if (subject.type === "LAB") {
      if (ids.length < 1 || ids.length > 3) {
        return res.status(400).json({
          ok: false,
          error: "LAB must have 1 to 3 faculties selected",
        });
      }
    } else {
      if (ids.length !== 1) {
        return res.status(400).json({
          ok: false,
          error: "THEORY/NON_CREDIT must have exactly 1 faculty selected",
        });
      }
    }

    // Validate semester
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) {
      return res.status(404).json({ ok: false, error: "Semester not found" });
    }

    // Validate section belongs to semester batch
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.batchId !== semester.batchId) {
      return res.status(400).json({
        ok: false,
        error: "sectionId does not belong to this semester's batch",
      });
    }

    // Validate faculty exist + belong to SAME department as the batch
    const batch = await prisma.batch.findUnique({ where: { id: semester.batchId } });
    if (!batch) return res.status(400).json({ ok: false, error: "Invalid batch for semester" });

    const facRows = await prisma.faculty.findMany({
      where: { id: { in: ids }, isActive: true },
    });

    if (facRows.length !== ids.length) {
      return res.status(400).json({ ok: false, error: "One or more facultyIds are invalid" });
    }

    const wrongDept = facRows.find((f) => f.departmentId !== batch.departmentId);
    if (wrongDept) {
      return res.status(400).json({
        ok: false,
        error: "Selected faculty must belong to the same department as the selected batch",
      });
    }

    // Upsert assignment + its faculty links
    const assignment = await prisma.$transaction(async (tx) => {
      const existing = await tx.teachingAssignment.findFirst({
        where: { semesterId, sectionId, subjectId },
      });

      let a;
      if (existing) {
        a = await tx.teachingAssignment.update({
          where: { id: existing.id },
          data: {},
        });

        await tx.teachingAssignmentFaculty.deleteMany({
          where: { assignmentId: a.id },
        });

        await tx.teachingAssignmentFaculty.createMany({
          data: ids.map((fid) => ({ assignmentId: a.id, facultyId: fid })),
        });
      } else {
        a = await tx.teachingAssignment.create({
          data: { semesterId, sectionId, subjectId },
        });

        await tx.teachingAssignmentFaculty.createMany({
          data: ids.map((fid) => ({ assignmentId: a.id, facultyId: fid })),
        });
      }

      return tx.teachingAssignment.findUnique({
        where: { id: a.id },
        include: {
          section: true,
          subject: true,
          faculties: { include: { faculty: true } },
        },
      });
    });

    // Warning check (per selected faculty)
    const warnings = [];
    for (const fid of ids) {
      const fac = await prisma.faculty.findUnique({ where: { id: fid } });
      const links = await prisma.teachingAssignmentFaculty.findMany({
        where: { facultyId: fid, assignment: { semesterId } },
        include: { assignment: { include: { subject: true } } },
      });

      let total = 0;
      for (const link of links) {
        const subj = link.assignment?.subject;
        if (!subj) continue;
        total += subj.type === "LAB" ? Number(subj.labDurationHours || 2) : 1;
      }

      const maxH = fac?.maxHoursPerWeek ?? 16;
      if (total > maxH) {
        warnings.push(`${fac?.name || "Faculty"} now has ${total}h/week assigned (max ${maxH}h).`);
      }
    }

    res.json({
      ok: true,
      assignment,
      warning: warnings.length ? warnings.join(" ") : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
});

app.get("/api/semesters/:semesterId/assignments", async (req, res) => {
  try {
    const { semesterId } = req.params;

    const assignments = await prisma.teachingAssignment.findMany({
      where: { semesterId },
      include: {
        section: true,
        subject: true,
        faculties: { include: { faculty: true } },
      },
      orderBy: [{ section: { sectionIndex: "asc" } }, { subject: { name: "asc" } }],
    });

    res.json({ ok: true, assignments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete("/api/assignments/:assignmentId", async (req, res) => {
  try {
    const { assignmentId } = req.params;

    await prisma.teachingAssignment.delete({ where: { id: assignmentId } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------
// Faculty load (for preview in Assignments UI)
// facultyId -> hours/week (based on assignment links)
// --------------------
app.get("/api/semesters/:semesterId/faculty-load", async (req, res) => {
  try {
    const { semesterId } = req.params;

    const links = await prisma.teachingAssignmentFaculty.findMany({
      where: { assignment: { semesterId } },
      include: { assignment: { include: { subject: true } } },
    });

    const load = {}; // facultyId -> hours
    for (const link of links) {
      const subj = link.assignment?.subject;
      if (!subj) continue;
      const h = subj.type === "LAB" ? Number(subj.labDurationHours || 2) : 1;
      load[link.facultyId] = (load[link.facultyId] || 0) + h;
    }

    res.json({ ok: true, load });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------
// Timetable Generator
// Labs: start only at P1 or P4 (2/3 hrs), max 1 lab/day/section preference, minimize parallel labs
// Non-credit: exactly 1 hr/week, prefer non-prime slots (P6/P5/P4) and later week days
// Theory: fill remaining slots balanced
// Faculty Load: per-faculty cap (default 16hrs/week)
// --------------------
app.post("/api/semesters/:semesterId/timetables/generate", async (req, res) => {
  const { semesterId } = req.params;
  const createdBy = req.body?.createdBy || "admin";

  try {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: { batch: { include: { sections: true } } },
    });
    if (!semester) {
      return res.status(404).json({ ok: false, error: "Semester not found" });
    }

    const sections = semester.batch.sections;

    const assignments = await prisma.teachingAssignment.findMany({
      where: { semesterId },
      include: {
        subject: true,
        section: true,
        faculties: { include: { faculty: true } },
      },
    });

    if (assignments.length === 0) {
      return res.status(400).json({ ok: false, error: "No assignments found for this semester" });
    }

    const DAYS = semester.daysPerWeek || 6;
    const PERIODS = semester.periodsPerDay || 6;

    // Busy sets
    const sectionBusy = new Set(); // `${sectionId}:${day}:${period}`
    const facultyBusy = new Set(); // `${facultyId}:${day}:${period}`

    // Lab/day rule tracker
    const labsPerDay = new Map(); // `${sectionId}:${day}` -> count of lab blocks

    // Parallel lab tracker
    const parallelLabCount = new Map(); // `${subjectId}:${day}:${period}` -> count

    // Faculty hours + caps
    const facultyHours = new Map(); // facultyId -> hours used
    const facultyMax = new Map(); // facultyId -> max hours
    for (const a of assignments) {
      for (const link of a.faculties) {
        const f = link.faculty;
        facultyMax.set(f.id, f.maxHoursPerWeek || 16);
        if (!facultyHours.has(f.id)) facultyHours.set(f.id, 0);
      }
    }

    const entries = []; // TimetableEntry rows with fixed ids
    const entryFacLinks = []; // TimetableEntryFaculty rows
    const mkEntryId = () => crypto.randomUUID();

    const isFreeMulti = (sectionId, facultyIds, day, period) => {
      if (sectionBusy.has(`${sectionId}:${day}:${period}`)) return false;
      for (const fid of facultyIds) {
        if (facultyBusy.has(`${fid}:${day}:${period}`)) return false;
      }
      return true;
    };

    const occupyMulti = (timetableId, sectionId, facultyIds, subjectId, day, period, blockId) => {
      sectionBusy.add(`${sectionId}:${day}:${period}`);
      for (const fid of facultyIds) {
        facultyBusy.add(`${fid}:${day}:${period}`);
      }

      const entryId = mkEntryId();
      entries.push({
        id: entryId,
        timetableId,
        sectionId,
        subjectId,
        dayOfWeek: day,
        periodNo: period,
        blockId,
      });

      for (const fid of facultyIds) {
        entryFacLinks.push({
          timetableEntryId: entryId,
          facultyId: fid,
        });
      }
    };

    // Preferred non-credit slots: later days + non-prime periods
    const preferredNonCreditSlots = () => {
      const preferredDays = [6, 5, 4, 3, 2, 1].filter((d) => d <= DAYS);
      const preferredPeriods = [6, 5, 4].filter((p) => p <= PERIODS);
      const slots = [];
      for (const d of preferredDays) for (const p of preferredPeriods) slots.push({ day: d, period: p });
      return slots;
    };

    // Group by section
    const bySection = new Map(); // sectionId -> { name, labs:[], theory:[], nonCredit:[] }
    for (const s of sections) bySection.set(s.id, { name: s.name, labs: [], theory: [], nonCredit: [] });

    for (const a of assignments) {
      const grp = bySection.get(a.sectionId);
      if (!grp) continue;
      if (a.subject.type === "LAB") grp.labs.push(a);
      else if (a.subject.type === "NON_CREDIT") grp.nonCredit.push(a);
      else grp.theory.push(a);
    }

    // THEORY balancing counters
    const theoryCountBySection = new Map();
    for (const [sectionId, grp] of bySection.entries()) {
      const m = new Map();
      for (const a of grp.theory) m.set(a.subjectId, 0);
      theoryCountBySection.set(sectionId, m);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate current active timetable
      const active = await tx.timetable.findFirst({ where: { semesterId, status: "ACTIVE" } });
      if (active) await tx.timetable.update({ where: { id: active.id }, data: { status: "INACTIVE" } });

      // Next version
      const last = await tx.timetable.findFirst({ where: { semesterId }, orderBy: { versionNo: "desc" } });
      const versionNo = last ? last.versionNo + 1 : 1;

      const timetable = await tx.timetable.create({
        data: { semesterId, versionNo, status: "ACTIVE", createdBy },
      });
      const timetableId = timetable.id;

      const warnings = [];

      // --------------------
      // LAB placement
      // --------------------
      for (const [sectionId, grp] of bySection.entries()) {
        for (const a of grp.labs) {
          const d = a.subject.labDurationHours || 3;
          const possibleStarts = [1, 4].filter((s) => s + d - 1 <= PERIODS);

          const facultyIds = a.faculties.map((x) => x.facultyId);
          if (!facultyIds.length) {
            throw new Error(`LAB "${a.subject.name}" for section ${a.section.name} has no faculty assigned.`);
          }

          const daysOrdered = [...Array.from({ length: DAYS }, (_, i) => i + 1)].sort((d1, d2) => {
            const c1 = labsPerDay.get(`${sectionId}:${d1}`) || 0;
            const c2 = labsPerDay.get(`${sectionId}:${d2}`) || 0;
            return c1 - c2;
          });

          let best = null;

          for (const day of daysOrdered) {
            for (const start of possibleStarts) {
              // Check hours for all faculty in this lab
              let okHours = true;
              for (const fid of facultyIds) {
                const used = facultyHours.get(fid) || 0;
                const maxH = facultyMax.get(fid) || 16;
                if (used + d > maxH) {
                  okHours = false;
                  break;
                }
              }
              if (!okHours) continue;

              // Check collisions for all periods
              let ok = true;
              for (let p = start; p < start + d; p++) {
                if (!isFreeMulti(sectionId, facultyIds, day, p)) {
                  ok = false;
                  break;
                }
              }
              if (!ok) continue;

              // Parallel penalty
              let parallelPenalty = 0;
              for (let p = start; p < start + d; p++) {
                const k = `${a.subjectId}:${day}:${p}`;
                parallelPenalty += parallelLabCount.get(k) || 0;
              }

              const labDayCount = labsPerDay.get(`${sectionId}:${day}`) || 0;
              const labDayPenalty = labDayCount >= 1 ? 1000 : 0;

              const penalty = labDayPenalty + parallelPenalty * 50;

              if (!best || penalty < best.penalty) best = { day, start, penalty, parallelPenalty };
            }
          }

          if (!best) {
            throw new Error(
              `Could not place LAB "${a.subject.name}" for section ${a.section.name} (faculty hours/collisions too tight).`
            );
          }

          const blockId = crypto.randomUUID();
          for (let p = best.start; p < best.start + d; p++) {
            occupyMulti(timetableId, sectionId, facultyIds, a.subjectId, best.day, p, blockId);
            const pk = `${a.subjectId}:${best.day}:${p}`;
            parallelLabCount.set(pk, (parallelLabCount.get(pk) || 0) + 1);
          }

          for (const fid of facultyIds) {
            facultyHours.set(fid, (facultyHours.get(fid) || 0) + d);
          }

          const dk = `${sectionId}:${best.day}`;
          labsPerDay.set(dk, (labsPerDay.get(dk) || 0) + 1);

          if (best.parallelPenalty > 0) {
            warnings.push(
              `Parallel lab reduced: "${a.subject.name}" overlapped with another section on day ${best.day} (periods ${best.start}-${best.start + d - 1}).`
            );
          }
        }
      }

      // --------------------
      // NON_CREDIT placement first (so it doesn't get blocked by theory)
      // --------------------
      for (const [sectionId, grp] of bySection.entries()) {
        if (!grp.nonCredit || grp.nonCredit.length === 0) continue;

        for (const a of grp.nonCredit) {
          const facultyIds = a.faculties.map((x) => x.facultyId);
          if (facultyIds.length !== 1) {
            warnings.push(`NON_CREDIT "${a.subject.name}" for Section ${grp.name} should have exactly 1 faculty.`);
            continue;
          }

          const fid = facultyIds[0];
          const used = facultyHours.get(fid) || 0;
          const maxH = facultyMax.get(fid) || 16;

          if (used + 1 > maxH) {
            warnings.push(
              `NON_CREDIT "${a.subject.name}" not placed for Section ${grp.name} (faculty hours exceeded).`
            );
            continue;
          }

          let placed = false;
          for (const { day, period } of preferredNonCreditSlots()) {
            if (!isFreeMulti(sectionId, [fid], day, period)) continue;

            occupyMulti(timetableId, sectionId, [fid], a.subjectId, day, period, null);
            facultyHours.set(fid, (facultyHours.get(fid) || 0) + 1);
            placed = true;
            break;
          }

          if (!placed) {
            warnings.push(
              `NON_CREDIT "${a.subject.name}" not placed for Section ${grp.name} (no free non-prime slots).`
            );
          }
        }
      }

      // --------------------
      // THEORY fill (balanced)
      // --------------------
      for (const [sectionId, grp] of bySection.entries()) {
        if (grp.labs.length === 0 && grp.theory.length === 0 && grp.nonCredit.length === 0) {
          warnings.push(`Section ${grp.name} has no assignments; timetable skipped.`);
          continue;
        }

        const counts = theoryCountBySection.get(sectionId) || new Map();

        for (let day = 1; day <= DAYS; day++) {
          for (let period = 1; period <= PERIODS; period++) {
            if (sectionBusy.has(`${sectionId}:${day}:${period}`)) continue;
            if (grp.theory.length === 0) continue;

            const orderedTheory = [...grp.theory].sort((a1, a2) => {
              const c1 = counts.get(a1.subjectId) || 0;
              const c2 = counts.get(a2.subjectId) || 0;
              return c1 - c2;
            });

            for (const a of orderedTheory) {
              const facultyIds = a.faculties.map((x) => x.facultyId);
              if (facultyIds.length !== 1) continue;
              const fid = facultyIds[0];

              const used = facultyHours.get(fid) || 0;
              const maxH = facultyMax.get(fid) || 16;
              if (used + 1 > maxH) continue;
              if (!isFreeMulti(sectionId, [fid], day, period)) continue;

              occupyMulti(timetableId, sectionId, [fid], a.subjectId, day, period, null);
              facultyHours.set(fid, used + 1);
              counts.set(a.subjectId, (counts.get(a.subjectId) || 0) + 1);
              break;
            }
          }
        }
      }

      // Free periods summary
      for (const [sectionId, grp] of bySection.entries()) {
        if (grp.labs.length === 0 && grp.theory.length === 0 && grp.nonCredit.length === 0) continue;

        let free = 0;
        for (let day = 1; day <= DAYS; day++) {
          for (let period = 1; period <= PERIODS; period++) {
            if (!sectionBusy.has(`${sectionId}:${day}:${period}`)) free++;
          }
        }

        if (free > 0) {
          warnings.push(
            `Section ${grp.name} has ${free} free periods this week due to limited faculty hours / assignments.`
          );
        }
      }

      await tx.timetableEntry.createMany({ data: entries });
      await tx.timetableEntryFaculty.createMany({ data: entryFacLinks });

      return { timetable, warnings };
    });

    res.json({
      ok: true,
      timetable: result.timetable,
      warnings: result.warnings,
      facultyHours: Object.fromEntries(facultyHours),
      insertedEntries: entries.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ACTIVE timetable endpoint
app.get("/api/semesters/:semesterId/timetables/active", async (req, res) => {
  try {
    const { semesterId } = req.params;

    const timetable = await prisma.timetable.findFirst({
      where: { semesterId, status: "ACTIVE" },
      orderBy: { versionNo: "desc" },
    });

    res.json({ ok: true, timetable: timetable || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// View timetable entries (includes multiple faculty)
app.get("/api/timetables/:timetableId/entries", async (req, res) => {
  try {
    const { timetableId } = req.params;
    const entries = await prisma.timetableEntry.findMany({
      where: { timetableId },
      include: {
        section: true,
        subject: true,
        faculties: { include: { faculty: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { periodNo: "asc" }],
    });
    res.json({ ok: true, entries });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PDF Export
app.get("/api/timetables/:timetableId/pdf", async (req, res) => {
  try {
    const { timetableId } = req.params;

    const entries = await prisma.timetableEntry.findMany({
      where: { timetableId },
      include: {
        section: true,
        subject: true,
        faculties: { include: { faculty: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { periodNo: "asc" }],
    });

    if (!entries.length) {
      return res.status(404).json({ ok: false, error: "No timetable entries found" });
    }

    const html = buildTimetableHtml(entries, timetableId);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    const timetable = await prisma.timetable.findUnique({
  where: { id: timetableId },
  include: { semester: { include: { batch: true } } },
});

const batch = timetable?.semester?.batch;
const semNo = timetable?.semester?.semesterNo;

const batchName = batch?.program
  ? `${batch.program} ${batch.startYear}`
  : `Batch ${batch?.startYear ?? ""}`;

const semName = semNo ? `Semester ${semNo}` : "Semester";

const safe = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").trim();
const filename = `${safe(batchName)} ${safe(semName)} Timetable.pdf`;

res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);


    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "PDF generation failed" });
  }
});

function buildTimetableHtml(entries, timetableId) {
  const days = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  };

  const preLunch = [1, 2, 3];
  const postLunch = [4, 5, 6];

  // Build: section -> day -> period -> entry
  const bySection = {};
  for (const e of entries) {
    const sec = e.section?.name || "Unknown";
    bySection[sec] ??= {};
    bySection[sec][e.dayOfWeek] ??= {};
    bySection[sec][e.dayOfWeek][e.periodNo] = e;
  }

  const cellText = (e) => {
    if (!e) return "";
    const facNames =
      (e.faculties || []).map((x) => x.faculty?.name).filter(Boolean).join(", ") || "";
    const subj = e.subject?.code || e.subject?.name || "";
    return facNames ? `${subj} (${facNames})` : subj;
  };

  // For lab merge: count span within a segment using blockId
  const spanWithin = (dayMap, startPeriod, segmentPeriods) => {
    const e = dayMap[startPeriod];
    if (!e || !e.blockId) return 1;

    let span = 1;
    const idx = segmentPeriods.indexOf(startPeriod);
    for (let k = idx + 1; k < segmentPeriods.length; k++) {
      const p = segmentPeriods[k];
      const nextE = dayMap[p];
      if (!nextE || nextE.blockId !== e.blockId) break;
      span++;
    }
    return span;
  };

  const sectionsHtml = Object.keys(bySection)
    .sort()
    .map((sec) => {
      const bodyRows = Object.entries(days).map(([dNo, dName], rowIndex) => {
        const day = Number(dNo);
        const dayMap = bySection[sec]?.[day] || {};
        let tds = "";

        // Pre lunch cells with merge
        for (let i = 0; i < preLunch.length; ) {
          const p = preLunch[i];
          const span = spanWithin(dayMap, p, preLunch);
          const txt = cellText(dayMap[p]);
          tds += `<td class="cell" colspan="${span}">${txt}</td>`;
          i += span;
        }

        // Lunch cell only once with rowSpan
        if (rowIndex === 0) {
          tds += `<td class="lunch" rowspan="${Object.keys(days).length}"><div class="lunchText">Lunch</div></td>`;
        }

        // Post lunch cells with merge
        for (let i = 0; i < postLunch.length; ) {
          const p = postLunch[i];
          const span = spanWithin(dayMap, p, postLunch);
          const txt = cellText(dayMap[p]);
          tds += `<td class="cell" colspan="${span}">${txt}</td>`;
          i += span;
        }

        return `
          <tr>
            <th class="dayHead">${dName}</th>
            ${tds}
          </tr>
        `;
      });

      return `
        <h2>Section ${sec}</h2>
        <table class="tt">
          <thead>
            <tr>
              <th class="head">Day</th>
              <th class="head">P1</th>
              <th class="head">P2</th>
              <th class="head">P3</th>
              <th class="head">Lunch</th>
              <th class="head">P4</th>
              <th class="head">P5</th>
              <th class="head">P6</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows.join("")}
          </tbody>
        </table>
        <br/>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { margin: 0 0 6px 0; }
          h2 { margin: 18px 0 8px 0; }

          .tt { width: 100%; border-collapse: collapse; font-size: 10px; }
          .tt th, .tt td { border: 1px solid #333; padding: 6px; vertical-align: top; }
          .head { background: #e9e9e9; font-weight: 700; text-align: left; }
          .dayHead { background: #f3f3f3; font-weight: 700; text-align: left; width: 90px; }

          .cell { background: #fff; }
          .lunch { background: #eeeeee; text-align: center; width: 46px; padding: 0; }
          .lunchText {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            font-weight: 800;
            letter-spacing: 2px;
            display: inline-block;
            padding: 8px 0;
          }
        </style>
      </head>
      <body>
        <h1>Semester Timetable</h1>
        ${sectionsHtml}
      </body>
    </html>
  `;
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
