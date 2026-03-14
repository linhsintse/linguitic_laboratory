CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL UNIQUE
);

CREATE TABLE "WeeklyTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    UNIQUE ("weekNumber", "year")
);

CREATE TABLE "WeeklyEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "weeklyTableId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
    "position" INTEGER, -- Allows you to retain order (1 through 10) without breaking schema
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id"),
    FOREIGN KEY ("weeklyTableId") REFERENCES "WeeklyTable" ("id")
);

CREATE TABLE "Morpheme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL, -- e.g., 'prefix', 'root', 'suffix'
    "text" TEXT NOT NULL UNIQUE
);

-- Join table (Many-to-Many): A word can have multiple morphemes, 
-- and a morpheme belongs to multiple words.
CREATE TABLE "WordMorpheme" (
    "wordId" INTEGER NOT NULL,
    "morphemeId" INTEGER NOT NULL,
    PRIMARY KEY ("wordId", "morphemeId"),
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id"),
    FOREIGN KEY ("morphemeId") REFERENCES "Morpheme" ("id")
);