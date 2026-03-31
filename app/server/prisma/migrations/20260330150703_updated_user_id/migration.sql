/*
  Warnings:

  - Added the required column `userId` to the `Worksheet` table without a default value. This is not possible if the table is not empty.

*/

-- Create the new table with a default value for the new column
CREATE TABLE "new_Worksheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Worksheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy data from the old table to the new table
INSERT INTO "new_Worksheet" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Worksheet";

-- Drop the old table
DROP TABLE "Worksheet";

-- Rename the new table to the original table name
ALTER TABLE "new_Worksheet" RENAME TO "Worksheet";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

