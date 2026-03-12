-- CreateTable
CREATE TABLE "WeeklyTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "VocabularyWord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordText" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "weeklyTableId" INTEGER NOT NULL,
    CONSTRAINT "VocabularyWord_weeklyTableId_fkey" FOREIGN KEY ("weeklyTableId") REFERENCES "WeeklyTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTable_weekNumber_year_key" ON "WeeklyTable"("weekNumber", "year");
