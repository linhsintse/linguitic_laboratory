/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "KaikkiEtymology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "term" TEXT NOT NULL,
    "lang" TEXT,
    "pos" TEXT,
    "template_name" TEXT NOT NULL,
    "morpheme" TEXT NOT NULL,
    "morpheme_lang" TEXT,
    "position" INTEGER NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstname" TEXT,
    "lastname" TEXT,
    "role" TEXT,
    "password" TEXT NOT NULL
);
INSERT INTO "new_User" ("email", "id", "password", "username") SELECT "email", "id", "password", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "KaikkiEtymology_term_idx" ON "KaikkiEtymology"("term");

-- CreateIndex
CREATE INDEX "KaikkiEtymology_morpheme_idx" ON "KaikkiEtymology"("morpheme");

-- CreateIndex
CREATE INDEX "KaikkiEtymology_template_name_idx" ON "KaikkiEtymology"("template_name");
