-- CreateTable
CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Worksheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorksheetEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "worksheetId" INTEGER NOT NULL,
    "columnIndex" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "WorksheetEntry_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorksheetEntry_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "Worksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorksheetColumn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "worksheetId" INTEGER NOT NULL,
    "columnIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "WorksheetColumn_worksheetId_fkey" FOREIGN KEY ("worksheetId") REFERENCES "Worksheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Etymology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "term_id" TEXT NOT NULL,
    "lang" TEXT,
    "term" TEXT,
    "reltype" TEXT,
    "related_term_id" TEXT,
    "related_lang" TEXT,
    "related_term" TEXT,
    "position" INTEGER,
    "group_tag" TEXT,
    "parent_tag" TEXT,
    "parent_position" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "Word_text_key" ON "Word"("text");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "WorksheetColumn_worksheetId_columnIndex_key" ON "WorksheetColumn"("worksheetId", "columnIndex");
