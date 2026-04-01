/*
  Warnings:

  - You are about to drop the `Etymology` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `name` on the `WorksheetColumn` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Etymology";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorksheetColumn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "worksheetId" INTEGER NOT NULL,
    "columnIndex" INTEGER NOT NULL,
    "morpheme" TEXT,
    CONSTRAINT "WorksheetColumn_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "Worksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorksheetColumn" ("columnIndex", "id", "worksheetId") SELECT "columnIndex", "id", "worksheetId" FROM "WorksheetColumn";
DROP TABLE "WorksheetColumn";
ALTER TABLE "new_WorksheetColumn" RENAME TO "WorksheetColumn";
CREATE UNIQUE INDEX "WorksheetColumn_worksheetId_columnIndex_key" ON "WorksheetColumn"("worksheetId", "columnIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
