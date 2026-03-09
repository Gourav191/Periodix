/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `dayStartTime` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `lunchEndTime` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `lunchStartTime` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `periodDurationMins` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TeachingAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TimetableEntry` table. All the data in the column will be lost.
  - Made the column `branch` on table `Batch` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `departmentId` to the `Faculty` table without a default value. This is not possible if the table is not empty.
  - Made the column `createdBy` on table `Timetable` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "program" TEXT,
    "branch" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "sectionsCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Batch" ("branch", "createdAt", "durationYears", "endYear", "id", "program", "sectionsCount", "startYear") SELECT "branch", "createdAt", "durationYears", "endYear", "id", "program", "sectionsCount", "startYear" FROM "Batch";
DROP TABLE "Batch";
ALTER TABLE "new_Batch" RENAME TO "Batch";
CREATE TABLE "new_Faculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "maxHoursPerWeek" INTEGER NOT NULL DEFAULT 16,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Faculty_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Faculty" ("createdAt", "id", "isActive", "maxHoursPerWeek", "name") SELECT "createdAt", "id", "isActive", "maxHoursPerWeek", "name" FROM "Faculty";
DROP TABLE "Faculty";
ALTER TABLE "new_Faculty" RENAME TO "Faculty";
CREATE TABLE "new_Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Section_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Section" ("batchId", "id", "name", "sectionIndex") SELECT "batchId", "id", "name", "sectionIndex" FROM "Section";
DROP TABLE "Section";
ALTER TABLE "new_Section" RENAME TO "Section";
CREATE TABLE "new_Semester" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "semesterNo" INTEGER NOT NULL,
    "daysPerWeek" INTEGER NOT NULL DEFAULT 6,
    "periodsPerDay" INTEGER NOT NULL DEFAULT 6,
    CONSTRAINT "Semester_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Semester" ("batchId", "daysPerWeek", "id", "periodsPerDay", "semesterNo") SELECT "batchId", "daysPerWeek", "id", "periodsPerDay", "semesterNo" FROM "Semester";
DROP TABLE "Semester";
ALTER TABLE "new_Semester" RENAME TO "Semester";
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "labDurationHours" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Subject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("code", "id", "isActive", "labDurationHours", "name", "semesterId", "type") SELECT "code", "id", "isActive", "labDurationHours", "name", "semesterId", "type" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE TABLE "new_TeachingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    CONSTRAINT "TeachingAssignment_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeachingAssignment_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TeachingAssignment" ("facultyId", "id", "sectionId", "semesterId", "subjectId") SELECT "facultyId", "id", "sectionId", "semesterId", "subjectId" FROM "TeachingAssignment";
DROP TABLE "TeachingAssignment";
ALTER TABLE "new_TeachingAssignment" RENAME TO "TeachingAssignment";
CREATE UNIQUE INDEX "TeachingAssignment_semesterId_sectionId_subjectId_facultyId_key" ON "TeachingAssignment"("semesterId", "sectionId", "subjectId", "facultyId");
CREATE TABLE "new_Timetable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timetable_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Timetable" ("createdAt", "createdBy", "id", "semesterId", "status", "versionNo") SELECT "createdAt", "createdBy", "id", "semesterId", "status", "versionNo" FROM "Timetable";
DROP TABLE "Timetable";
ALTER TABLE "new_Timetable" RENAME TO "Timetable";
CREATE TABLE "new_TimetableEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timetableId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "blockId" TEXT,
    CONSTRAINT "TimetableEntry_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimetableEntry" ("blockId", "dayOfWeek", "facultyId", "id", "periodNo", "sectionId", "subjectId", "timetableId") SELECT "blockId", "dayOfWeek", "facultyId", "id", "periodNo", "sectionId", "subjectId", "timetableId" FROM "TimetableEntry";
DROP TABLE "TimetableEntry";
ALTER TABLE "new_TimetableEntry" RENAME TO "TimetableEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
