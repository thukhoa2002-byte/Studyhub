import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { zstdDecompressSync } from "node:zlib";

const CLOZE_PATTERN = /\{\{c\d+::(.*?)(?:::.*?)?\}\}/g;
const MAX_APKG_BYTES = 120 * 1024 * 1024;

export async function importAnkiPackage(file) {
  if (!file?.buffer) {
    throw new Error("Không có file Anki.");
  }

  if (file.size > MAX_APKG_BYTES) {
    throw new Error("File Anki quá lớn.");
  }

  const workdir = await mkdtemp(path.join(tmpdir(), "anki-import-"));
  const packagePath = path.join(workdir, file.originalname || "deck.apkg");
  const databasePath = path.join(workdir, "collection.sqlite");

  try {
    await writeFile(packagePath, file.buffer);

    const databaseBuffer = await extractAnkiDatabase(packagePath);
    await writeFile(databasePath, databaseBuffer);

    const questions = readAnkiDatabase(databasePath);

    return {
      title: path.basename(file.originalname || "Anki deck", path.extname(file.originalname || "")),
      questions,
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function extractAnkiDatabase(packagePath) {
  for (const entry of ["collection.anki21b", "collection.anki21", "collection.anki2"]) {
    try {
      const database = await unzipEntry(packagePath, entry);
      return entry.endsWith("b") ? zstdDecompressSync(database) : database;
    } catch {
      // Try the next collection format used by Anki packages.
    }
  }

  throw new Error("Không tìm thấy database Anki trong file .apkg.");
}

function unzipEntry(packagePath, entry) {
  return new Promise((resolve, reject) => {
    execFile(
      "unzip",
      ["-p", packagePath, entry],
      { encoding: "buffer", maxBuffer: MAX_APKG_BYTES },
      (error, stdout) => {
        if (error || stdout.length === 0) {
          reject(error || new Error(`Không đọc được ${entry}.`));
          return;
        }

        resolve(stdout);
      }
    );
  });
}

function readAnkiDatabase(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });

  try {
    const deckNames = readDeckNames(database);
    const rows = database
      .prepare(
        `SELECT notes.id, notes.flds, cards.did
         FROM notes
         LEFT JOIN cards ON cards.nid = notes.id
         GROUP BY notes.id
         ORDER BY notes.id`
      )
      .all();

    return rows.flatMap((row, index) =>
      noteToQuestions(row, deckNames.get(String(row.did)) || "Anki", index)
    );
  } finally {
    database.close();
  }
}

function readDeckNames(database) {
  const deckNames = new Map();
  const row = database.prepare("SELECT decks FROM col LIMIT 1").get();

  if (!row?.decks) return deckNames;

  try {
    const decks = JSON.parse(row.decks);

    Object.entries(decks).forEach(([id, deck]) => {
      if (deck?.name) deckNames.set(id, deck.name);
    });
  } catch {
    return deckNames;
  }

  return deckNames;
}

function noteToQuestions(row, category, index) {
  const fields = String(row.flds || "").split("\u001f");
  const clozeCards = clozeToQuestions(fields, category);

  if (clozeCards.length > 0) return clozeCards;

  const front = cleanText(fields[0] || "");
  const back = cleanText(fields.slice(1).filter(Boolean).join("\n"));

  if (!front || !back) return [];

  return [
    {
      id: String(row.id || `${Date.now()}-${index}`),
      question: front,
      answer: back,
      category,
      importance: index + 1,
      bookmarked: false,
    },
  ];
}

function clozeToQuestions(fields, category) {
  const source = fields[0] || "";
  const extra = cleanText(fields.slice(1).filter(Boolean).join("\n"));
  const matches = [...source.matchAll(CLOZE_PATTERN)];

  return matches.map((match, index) => {
    const raw = match[0];
    const answer = cleanText(match[1]);
    const question = cleanText(
      source.replace(CLOZE_PATTERN, (value, hidden) =>
        value === raw ? "[...]" : hidden
      )
    );

    return {
      id: `${randomUUID()}-${index}`,
      question,
      answer: extra ? `${answer}\n${extra}` : answer,
      category,
      importance: index + 1,
      bookmarked: false,
    };
  }).filter((question) => question.question && question.answer);
}

function cleanText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>|<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
