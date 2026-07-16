import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { zstdDecompressSync } from "node:zlib";

const FIELD_SEPARATOR = "\u001f";
const CLOZE_PATTERN = /\{\{c(\d+)::(.*?)(?:::.*?)?\}\}/g;
export const MAX_APKG_BYTES = 500 * 1024 * 1024;

export async function importAnkiPackage(file) {
  if (!file?.path && !file?.buffer) throw new Error("Không có file Anki.");
  if (file.size > MAX_APKG_BYTES) throw new Error("File Anki lớn hơn giới hạn 500 MB.");

  const workdir = await mkdtemp(path.join(tmpdir(), "anki-import-"));
  const packagePath = path.join(workdir, "deck.apkg");
  const databasePath = path.join(workdir, "collection.sqlite");

  try {
    if (file.path) await copyFile(file.path, packagePath);
    else await writeFile(packagePath, file.buffer);

    const packageStats = await stat(packagePath);
    if (packageStats.size > MAX_APKG_BYTES) throw new Error("File Anki lớn hơn giới hạn 500 MB.");

    const { buffer: databaseBuffer, format } = await extractAnkiDatabase(packagePath);
    await writeFile(databasePath, databaseBuffer);

    const result = readAnkiDatabase(databasePath);
    const mediaCount = await readMediaCount(packagePath);

    return {
      title: result.rootDeck || path.basename(file.originalname || "Anki deck", path.extname(file.originalname || "")),
      questions: result.questions,
      summary: {
        format,
        noteCount: result.noteCount,
        cardCount: result.cardCount,
        deckCount: result.deckCount,
        noteTypeCount: result.noteTypeCount,
        mediaCount,
        skippedCount: result.skippedCount,
        mediaNotice: mediaCount > 0
          ? "Đã nhận diện media của Anki. Hình dung lượng lớn chưa được nhúng vào thẻ để tránh vượt giới hạn lưu trữ."
          : "",
      },
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function extractAnkiDatabase(packagePath) {
  for (const entry of ["collection.anki21b", "collection.anki21", "collection.anki2"]) {
    try {
      const database = await unzipEntry(packagePath, entry, 160 * 1024 * 1024);
      return {
        buffer: entry.endsWith("b") ? zstdDecompressSync(database) : database,
        format: entry,
      };
    } catch {
      // Try the next collection format used by Anki packages.
    }
  }
  throw new Error("Không tìm thấy database Anki trong file .apkg.");
}

async function readMediaCount(packagePath) {
  try {
    let media = await unzipEntry(packagePath, "media", 20 * 1024 * 1024);
    if (media[0] === 0x28 && media[1] === 0xb5 && media[2] === 0x2f && media[3] === 0xfd) {
      media = zstdDecompressSync(media);
    }
    const text = media.toString("utf8");
    if (text.trim().startsWith("{")) return Object.keys(JSON.parse(text)).length;
    return countProtobufMediaEntries(media);
  } catch {
    return 0;
  }
}

function countProtobufMediaEntries(buffer) {
  let offset = 0;
  let count = 0;
  while (offset < buffer.length) {
    const key = readVarint(buffer, offset);
    offset = key.offset;
    const wireType = key.value & 7;
    const field = key.value >> 3;
    if (wireType === 2) {
      const length = readVarint(buffer, offset);
      offset = length.offset + length.value;
      if (field === 1) count += 1;
    } else if (wireType === 0) {
      offset = readVarint(buffer, offset).offset;
    } else {
      return count;
    }
  }
  return count;
}

function readVarint(buffer, start) {
  let value = 0;
  let shift = 0;
  let offset = start;
  while (offset < buffer.length) {
    const byte = buffer[offset++];
    value += (byte & 0x7f) * (2 ** shift);
    if (byte < 0x80) return { value, offset };
    shift += 7;
  }
  return { value: 0, offset: buffer.length };
}

function unzipEntry(packagePath, entry, maxBuffer) {
  return new Promise((resolve, reject) => {
    execFile("unzip", ["-p", packagePath, entry], { encoding: "buffer", maxBuffer }, (error, stdout) => {
      if (error || stdout.length === 0) reject(error || new Error(`Không đọc được ${entry}.`));
      else resolve(stdout);
    });
  });
}

function readAnkiDatabase(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const deckNames = readDeckNames(database);
    const noteTypes = readNoteTypes(database);
    const rows = database.prepare(
      `SELECT notes.id, notes.mid, notes.tags, notes.flds, MIN(cards.did) AS did
       FROM notes LEFT JOIN cards ON cards.nid = notes.id
       GROUP BY notes.id ORDER BY notes.id`
    ).all();

    const questions = rows.flatMap((row, index) => noteToQuestions(
      row,
      deckNames.get(String(row.did)) || "Anki",
      noteTypes.get(String(row.mid)) || "",
      index
    ));
    const rootDeck = [...deckNames.values()].map((name) => name.split("::")[0]).find((name) => name && name !== "Default");

    return {
      questions,
      rootDeck,
      noteCount: rows.length,
      cardCount: Number(database.prepare("SELECT COUNT(*) AS count FROM cards").get()?.count || 0),
      deckCount: [...deckNames.values()].filter((name) => name !== "Default").length,
      noteTypeCount: noteTypes.size,
      skippedCount: Math.max(0, rows.length - new Set(questions.map((question) => question.sourceNoteId)).size),
    };
  } finally {
    database.close();
  }
}

function readDeckNames(database) {
  const names = new Map();
  try {
    database.prepare("SELECT id, name FROM decks").all().forEach((deck) => {
      if (deck?.name) names.set(String(deck.id), normalizeDeckName(deck.name));
    });
  } catch {
    // Older Anki collections keep decks as JSON in the col table.
  }
  if (names.size > 0) return names;
  try {
    const row = database.prepare("SELECT decks FROM col LIMIT 1").get();
    Object.entries(JSON.parse(row?.decks || "{}"))
      .forEach(([id, deck]) => { if (deck?.name) names.set(id, normalizeDeckName(deck.name)); });
  } catch {
    return names;
  }
  return names;
}

function readNoteTypes(database) {
  const types = new Map();
  try {
    database.prepare("SELECT id, name FROM notetypes").all()
      .forEach((type) => types.set(String(type.id), String(type.name || "")));
  } catch {
    try {
      const row = database.prepare("SELECT models FROM col LIMIT 1").get();
      Object.entries(JSON.parse(row?.models || "{}"))
        .forEach(([id, model]) => types.set(id, String(model?.name || "")));
    } catch {
      return types;
    }
  }
  return types;
}

function normalizeDeckName(name) {
  return String(name).replaceAll(FIELD_SEPARATOR, "::");
}

function noteToQuestions(row, category, noteType, index) {
  const fields = String(row.flds || "").split(FIELD_SEPARATOR);
  const normalizedType = noteType.toLowerCase();
  const base = { category, sourceNoteId: String(row.id), tags: parseTags(row.tags) };

  if (normalizedType.includes("mcq_3_questions")) return caseMcqToQuestions(fields, base, index);
  if (normalizedType.includes("trạm anki") || normalizedType.includes("mcq đơn")) return singleMcqToQuestions(fields, base, index);
  if (normalizedType.includes("multiple choice")) return multipleChoiceToQuestions(fields, base, index);
  if (normalizedType.includes("match pairs")) return matchingToQuestions(fields, base, index);

  const clozeCards = clozeToQuestions(fields, base, index);
  if (clozeCards.length > 0) return clozeCards;

  let frontIndex = 0;
  let backIndex = 1;
  if (normalizedType.includes("id,front,back")) { frontIndex = 1; backIndex = 2; }
  const front = cleanRichText(fields[frontIndex] || "");
  const back = cleanRichText(fields[backIndex] || fields.slice(frontIndex + 1).find(Boolean) || "");
  return front && back ? [makeQuestion(base, row.id || index, front, back, index)] : [];
}

function multipleChoiceToQuestions(fields, base, index) {
  const question = cleanRichText(fields[1]);
  const options = fields.slice(3, 8).map(cleanPlainText).filter(Boolean);
  const flags = String(fields[8] || "").trim().split(/\s+/);
  const correctIndexes = flags.flatMap((flag, optionIndex) => flag === "1" ? [optionIndex] : []);
  if (!question || options.length < 2 || correctIndexes.length === 0) return [];
  const correctOptions = correctIndexes.map((optionIndex) => options[optionIndex]).filter(Boolean);
  const explanation = joinRichText([fields[9], fields[10]]);
  return [makeMcq(base, `${base.sourceNoteId}-${index}`, question, options, correctOptions, explanation, index)];
}

function singleMcqToQuestions(fields, base, index) {
  const question = cleanRichText(fields[2]);
  const options = fields.slice(3, 8).map(cleanPlainText).filter(Boolean);
  const letter = String(fields[8] || "").trim().toUpperCase();
  const correctIndex = letter.charCodeAt(0) - 65;
  if (!question || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return [];
  const explanations = fields.slice(9, 14).filter(Boolean);
  const explanation = joinRichText([fields[1], explanations[correctIndex], ...explanations.filter((_, i) => i !== correctIndex)]);
  return [makeMcq(base, `${base.sourceNoteId}-${index}`, question, options, [options[correctIndex]], explanation, index)];
}

function caseMcqToQuestions(fields, base, index) {
  const caseText = cleanRichText(fields[0]);
  const extra = cleanRichText(fields[16] || "");
  const questions = [];
  for (let part = 0; part < 5; part += 1) {
    const offset = 1 + part * 3;
    const question = cleanRichText(fields[offset]);
    const options = splitChoices(fields[offset + 1]);
    const letter = String(fields[offset + 2] || "").trim().toUpperCase();
    const correctIndex = letter.charCodeAt(0) - 65;
    if (!question || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) continue;
    questions.push(makeMcq(
      base,
      `${base.sourceNoteId}-${part}`,
      joinRichText([caseText, question]),
      options,
      [options[correctIndex]],
      extra,
      index + part
    ));
  }
  return questions;
}

function matchingToQuestions(fields, base, index) {
  const title = cleanRichText(fields[0]);
  const left = splitPipeList(fields[1]);
  const right = splitPipeList(fields[2]);
  if (!title || left.length === 0 || right.length === 0) return [];
  const pairs = left.map((item, pairIndex) => `${pairIndex + 1}. ${item} — ${right[pairIndex] || "?"}`).join("<br>");
  return [makeQuestion(base, `${base.sourceNoteId}-${index}`, title, joinRichText([pairs, fields[3]]), index)];
}

function clozeToQuestions(fields, base, index) {
  const sourceIndex = fields.findIndex((field) => /\{\{c\d+::/.test(field));
  if (sourceIndex < 0) return [];
  const source = fields[sourceIndex];
  const numbers = [...new Set([...source.matchAll(CLOZE_PATTERN)].map((match) => match[1]))];
  const extra = joinRichText(fields.filter((_, fieldIndex) => fieldIndex !== sourceIndex));

  return numbers.map((number, clozeIndex) => {
    const answers = [];
    const question = cleanRichText(source.replace(CLOZE_PATTERN, (raw, current, hidden) => {
      if (current === number) { answers.push(cleanPlainText(hidden)); return "[…]"; }
      return hidden;
    }));
    const answerText = answers.filter(Boolean).join(" · ");
    return makeQuestion(base, `${base.sourceNoteId}-c${number}`, question, joinRichText([answerText, extra]), index + clozeIndex);
  }).filter((question) => question.question && question.answer);
}

function makeQuestion(base, id, question, answer, index) {
  return { ...base, id: String(id || randomUUID()), question, answer, importance: index + 1, bookmarked: false };
}

function makeMcq(base, id, question, options, correctOptions, explanation, index) {
  const answer = correctOptions.join(" · ");
  if (correctOptions.length > 1) {
    const optionList = options
      .map((option, optionIndex) => `<li>${String.fromCharCode(65 + optionIndex)}. ${option}</li>`)
      .join("");
    return makeQuestion(
      base,
      id,
      `${question}<ol>${optionList}</ol>`,
      joinRichText([`Đáp án đúng: ${answer}`, explanation]),
      index
    );
  }
  return {
    ...makeQuestion(base, id, question, answer, index),
    options,
    correctOption: correctOptions.length === 1 ? correctOptions[0] : undefined,
    explanation: explanation || `Đáp án: ${answer}`,
  };
}

function splitChoices(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .split(/\n+/)
    .map((choice) => cleanPlainText(choice).replace(/^[A-E][.)]\s*/i, ""))
    .filter(Boolean);
}

function splitPipeList(value) {
  return String(value || "").split("|").map(cleanPlainText).filter(Boolean);
}

function parseTags(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean);
}

function joinRichText(values) {
  return values.map(cleanRichText).filter(Boolean).join("<br>");
}

function cleanPlainText(value = "") {
  return decodeEntities(String(value).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function cleanRichText(value = "") {
  return decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/<img\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)[^>]*>/gi, (_, source) => `<em>[Hình Anki: ${path.basename(source)}]</em>`)
    .replace(/<(?!\/?(?:b|strong|i|em|u|s|br|p|div|ul|ol|li|h1|h2|h3)\b)[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'");
}
