/*
  Warnings:

  - You are about to drop the column `branch` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `facultyId` on the `TeachingAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `facultyId` on the `TimetableEntry` table. All the data in the column will be lost.
  - Added the required column `departmentId` to the `Batch` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "TeachingAssignmentFaculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingAssignmentFaculty_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignmentFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableEntryFaculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableEntryId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimetableEntryFaculty_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "TimetableEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntryFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "program" TEXT,
    "departmentId" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "durationYears" INTEGER NOT NULL DEFAULT 4,
    "sectionsCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Batch_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Batch" ("createdAt", "durationYears", "endYear", "id", "program", "sectionsCount", "startYear") SELECT "createdAt", "durationYears", "endYear", "id", "program", "sectionsCount", "startYear" FROM "Batch";
DROP TABLE "Batch";
ALTER TABLE "new_Batch" RENAME TO "Batch";
CREATE TABLE "new_Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Section_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Section" ("batchId", "id", "name", "sectionIndex") SELECT "batchId", "id", "name", "sectionIndex" FROM "Section";
DROP TABLE "Section";
ALTER TABLE "new_Section" RENAME TO "Section";
CREATE UNIQUE INDEX "Section_batchId_sectionIndex_key" ON "Section"("batchId", "sectionIndex");
CREATE UNIQUE INDEX "Section_batchId_name_key" ON "Section"("batchId", "name");
CREATE TABLE "new_Semester" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "semesterNo" INTEGER NOT NULL,
    "daysPerWeek" INTEGER NOT NULL DEFAULT 6,
    "periodsPerDay" INTEGER NOT NULL DEFAULT 6,
    "periodDurationMins" INTEGER NOT NULL DEFAULT 60,
    "dayStartTime" TEXT NOT NULL DEFAULT '09:40',
    "lunchStartTime" TEXT NOT NULL DEFAULT '12:40',
    "lunchEndTime" TEXT NOT NULL DEFAULT '13:20',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Semester_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Semester" ("batchId", "daysPerWeek", "id", "periodsPerDay", "semesterNo") SELECT "batchId", "daysPerWeek", "id", "periodsPerDay", "semesterNo" FROM "Semester";
DROP TABLE "Semester";
ALTER TABLE "new_Semester" RENAME TO "Semester";
CREATE UNIQUE INDEX "Semester_batchId_semesterNo_key" ON "Semester"("batchId", "semesterNo");
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "labDurationHours" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("code", "id", "isActive", "labDurationHours", "name", "semesterId", "type") SELECT "code", "id", "isActive", "labDurationHours", "name", "semesterId", "type" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE TABLE "new_TeachingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingAssignment_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeachingAssignment" ("id", "sectionId", "semesterId", "subjectId") SELECT "id", "sectionId", "semesterId", "subjectId" FROM "TeachingAssignment";
DROP TABLE "TeachingAssignment";
ALTER TABLE "new_TeachingAssignment" RENAME TO "TeachingAssignment";
CREATE UNIQUE INDEX "TeachingAssignment_semesterId_sectionId_subjectId_key" ON "TeachingAssignment"("semesterId", "sectionId", "subjectId");
CREATE TABLE "new_Timetable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timetable_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Timetable" ("createdAt", "createdBy", "id", "semesterId", "status", "versionNo") SELECT "createdAt", "createdBy", "id", "semesterId", "status", "versionNo" FROM "Timetable";
DROP TABLE "Timetable";
ALTER TABLE "new_Timetable" RENAME TO "Timetable";
CREATE UNIQUE INDEX "Timetable_semesterId_versionNo_key" ON "Timetable"("semesterId", "versionNo");
CREATE TABLE "new_TimetableEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "subjectId" TEXT NOT NULL,
    "blockId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimetableEntry_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimetableEntry" ("blockId", "dayOfWeek", "id", "periodNo", "sectionId", "subjectId", "timetableId") SELECT "blockId", "dayOfWeek", "id", "periodNo", "sectionId", "subjectId", "timetableId" FROM "TimetableEntry";
DROP TABLE "TimetableEntry";
ALTER TABLE "new_TimetableEntry" RENAME TO "TimetableEntry";
CREATE UNIQUE INDEX "TimetableEntry_timetableId_sectionId_dayOfWeek_periodNo_key" ON "TimetableEntry"("timetableId", "sectionId", "dayOfWeek", "periodNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignmentFaculty_assignmentId_facultyId_key" ON "TeachingAssignmentFaculty"("assignmentId", "facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntryFaculty_timetableEntryId_facultyId_key" ON "TimetableEntryFaculty"("timetableEntryId", "facultyId");
