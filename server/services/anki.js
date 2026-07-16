import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { zstdDecompressSync } from "node:zlib";

const FIELD_SEPARATOR = "\u001f";
const CLOZE_PATTERN = /\{\{c(\d+)::(.*?)(?:::.*?)?\}\}/g;
const MEDIA_TOKEN_PATTERN = /\[\[ANKI_MEDIA:([A-Za-z0-9_-]+)\]\]/g;
const ANKI_MEDIA_BUCKET = "anki-media";
export const MAX_APKG_BYTES = 500 * 1024 * 1024;

export async function importAnkiPackage(file, options = {}) {
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
    const mediaManifest = await readMediaManifest(packagePath);
    const mediaResult = await uploadReferencedMedia(
      packagePath,
      result.questions,
      mediaManifest,
      options.authorization
    );

    return {
      title: result.rootDeck || path.basename(file.originalname || "Anki deck", path.extname(file.originalname || "")),
      questions: mediaResult.questions,
      summary: {
        format,
        noteCount: result.noteCount,
        cardCount: result.cardCount,
        deckCount: result.deckCount,
        noteTypeCount: result.noteTypeCount,
        mediaCount: mediaManifest.length,
        mediaReferenced: mediaResult.referenced,
        mediaUploaded: mediaResult.uploaded,
        mediaFailed: mediaResult.failed,
        skippedCount: result.skippedCount,
        mediaNotice: mediaResult.notice,
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

async function readMediaManifest(packagePath) {
  try {
    let media = await unzipEntry(packagePath, "media", 20 * 1024 * 1024);
    if (media[0] === 0x28 && media[1] === 0xb5 && media[2] === 0x2f && media[3] === 0xfd) {
      media = zstdDecompressSync(media);
    }
    const text = media.toString("utf8");
    if (text.trim().startsWith("{")) {
      return Object.entries(JSON.parse(text)).map(([archiveEntry, name]) => ({
        archiveEntry,
        name: String(name),
        size: 0,
        sha1: "",
      }));
    }
    return parseProtobufMediaEntries(media);
  } catch {
    return [];
  }
}

function parseProtobufMediaEntries(buffer) {
  let offset = 0;
  const entries = [];
  while (offset < buffer.length) {
    const key = readVarint(buffer, offset);
    offset = key.offset;
    const wireType = key.value & 7;
    const field = key.value >> 3;
    if (wireType === 2) {
      const length = readVarint(buffer, offset);
      const start = length.offset;
      const end = Math.min(buffer.length, start + length.value);
      if (field === 1) {
        const parsed = parseProtobufMediaEntry(buffer.subarray(start, end));
        if (parsed.name) entries.push({ ...parsed, archiveEntry: String(entries.length) });
      }
      offset = end;
    } else if (wireType === 0) {
      offset = readVarint(buffer, offset).offset;
    } else {
      return entries;
    }
  }
  return entries;
}

function parseProtobufMediaEntry(buffer) {
  let offset = 0;
  const entry = { name: "", size: 0, sha1: "" };
  while (offset < buffer.length) {
    const key = readVarint(buffer, offset);
    offset = key.offset;
    const field = key.value >> 3;
    const wireType = key.value & 7;
    if (wireType === 2) {
      const length = readVarint(buffer, offset);
      const start = length.offset;
      const end = Math.min(buffer.length, start + length.value);
      if (field === 1) entry.name = buffer.subarray(start, end).toString("utf8");
      if (field === 3) entry.sha1 = buffer.subarray(start, end).toString("hex");
      offset = end;
    } else if (wireType === 0) {
      const value = readVarint(buffer, offset);
      if (field === 2) entry.size = value.value;
      offset = value.offset;
    } else {
      break;
    }
  }
  return entry;
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

async function uploadReferencedMedia(packagePath, questions, manifest, authorization = "") {
  const referencedNames = collectReferencedMedia(questions);
  if (referencedNames.length === 0) {
    return {
      questions,
      referenced: 0,
      uploaded: 0,
      failed: 0,
      notice: manifest.length > 0 ? `Gói Anki có ${manifest.length} media nhưng không có hình nào được thẻ tham chiếu.` : "",
    };
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const bearer = String(authorization || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!supabaseUrl || !anonKey || !bearer) {
    return {
      questions: replaceMediaTokens(questions, new Map()),
      referenced: referencedNames.length,
      uploaded: 0,
      failed: referencedNames.length,
      notice: "Không thể lưu media vì phiên đăng nhập hoặc cấu hình Supabase chưa sẵn sàng.",
    };
  }

  const user = await fetchSupabaseUser(supabaseUrl, anonKey, bearer);
  const bucketReady = await canAccessAnkiMediaBucket(supabaseUrl, anonKey, bearer, user.id);
  if (!bucketReady) {
    return {
      questions: replaceMediaTokens(questions, new Map()),
      referenced: referencedNames.length,
      uploaded: 0,
      failed: referencedNames.length,
      notice: `Chưa có bucket ${ANKI_MEDIA_BUCKET}. Hãy chạy file supabase/anki_media_migration.sql một lần rồi nhập lại.`,
    };
  }
  const byName = buildMediaLookup(manifest);
  const selectedEntries = [...new Set(referencedNames
    .map((sourceName) => findMediaEntry(byName, sourceName)?.archiveEntry)
    .filter((entry) => /^\d+$/.test(String(entry || ""))))];
  const extractedMediaDirectory = path.join(path.dirname(packagePath), "media");
  await mkdir(extractedMediaDirectory, { recursive: true });
  if (selectedEntries.length > 0) await unzipEntries(packagePath, selectedEntries, extractedMediaDirectory);
  const resolved = new Map();
  let uploaded = 0;
  let failed = 0;

  await runWithConcurrency(referencedNames, 4, async (sourceName) => {
    const entry = findMediaEntry(byName, sourceName);
    if (!entry) {
      failed += 1;
      return;
    }
    try {
      let mediaBuffer = await readFile(path.join(extractedMediaDirectory, entry.archiveEntry));
      if (hasZstdMagic(mediaBuffer)) mediaBuffer = zstdDecompressSync(mediaBuffer);
      const mime = detectMediaMime(sourceName, mediaBuffer);
      if (!mime) throw new Error(`Định dạng media không hỗ trợ: ${sourceName}`);
      const digest = entry.sha1 || createHash("sha1").update(mediaBuffer).digest("hex");
      const extension = preferredExtension(sourceName, mime);
      const objectPath = `${user.id}/anki/${digest}${extension}`;
      await uploadStorageObject(supabaseUrl, anonKey, bearer, objectPath, mime, mediaBuffer);
      resolved.set(sourceName, `${supabaseUrl}/storage/v1/object/public/${ANKI_MEDIA_BUCKET}/${encodeObjectPath(objectPath)}`);
      uploaded += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Không thể nhập media Anki ${sourceName}:`, error.message);
    }
  });

  const notice = failed > 0
    ? `Đã lưu ${uploaded}/${referencedNames.length} media được thẻ sử dụng. ${failed} media chưa thể lưu; hãy kiểm tra bucket ${ANKI_MEDIA_BUCKET}.`
    : `Đã lưu đầy đủ ${uploaded} media được thẻ sử dụng vào Supabase Storage.`;

  return {
    questions: replaceMediaTokens(questions, resolved),
    referenced: referencedNames.length,
    uploaded,
    failed,
    notice,
  };
}

function unzipEntries(packagePath, entries, destination) {
  return new Promise((resolve, reject) => {
    execFile("unzip", ["-q", "-o", packagePath, ...entries, "-d", destination], { maxBuffer: 2 * 1024 * 1024 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function collectReferencedMedia(questions) {
  const names = new Set();
  questions.forEach((question) => {
    for (const value of mediaTextFields(question)) {
      for (const match of String(value || "").matchAll(MEDIA_TOKEN_PATTERN)) {
        try { names.add(Buffer.from(match[1], "base64url").toString("utf8")); } catch { /* Ignore invalid marker. */ }
      }
    }
  });
  return [...names];
}

function mediaTextFields(question) {
  return [question.question, question.answer, question.explanation, question.correctOption, ...(question.options || [])];
}

function replaceMediaTokens(questions, resolved) {
  return questions.map((question) => {
    const replace = (value) => typeof value === "string"
      ? value.replace(MEDIA_TOKEN_PATTERN, (_, token) => {
        let name = "media";
        try { name = Buffer.from(token, "base64url").toString("utf8"); } catch { /* Keep fallback name. */ }
        const url = resolved.get(name);
        return url
          ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(path.basename(name))}">`
          : `<em>[Hình Anki: ${escapeHtml(path.basename(name))}]</em>`;
      })
      : value;
    return {
      ...question,
      question: replace(question.question),
      answer: replace(question.answer),
      explanation: replace(question.explanation),
      correctOption: replace(question.correctOption),
      options: question.options?.map(replace),
    };
  });
}

function buildMediaLookup(manifest) {
  const lookup = new Map();
  manifest.forEach((entry) => {
    for (const key of mediaNameVariants(entry.name)) if (!lookup.has(key)) lookup.set(key, entry);
  });
  return lookup;
}

function findMediaEntry(lookup, sourceName) {
  for (const key of mediaNameVariants(sourceName)) {
    const entry = lookup.get(key);
    if (entry) return entry;
  }
  return null;
}

function mediaNameVariants(value) {
  const original = String(value || "").replace(/^file:\/\//i, "").split(/[?#]/)[0];
  let decoded = original;
  try { decoded = decodeURIComponent(original); } catch { /* Keep the source unchanged. */ }
  return [...new Set([original, decoded, path.basename(original), path.basename(decoded)].filter(Boolean).flatMap((item) => [item, item.normalize("NFC")]))];
}

async function fetchSupabaseUser(supabaseUrl, anonKey, bearer) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${bearer}` },
  });
  if (!response.ok) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const user = await response.json();
  if (!user?.id) throw new Error("Không xác định được tài khoản đang nhập Anki.");
  return user;
}

async function canAccessAnkiMediaBucket(supabaseUrl, anonKey, bearer, userId) {
  try {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${ANKI_MEDIA_BUCKET}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: `${userId}/anki`, limit: 1 }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function uploadStorageObject(supabaseUrl, anonKey, bearer, objectPath, mime, body) {
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${ANKI_MEDIA_BUCKET}/${encodeObjectPath(objectPath)}`;
  const existing = await fetch(publicUrl, { method: "HEAD", headers: { apikey: anonKey } });
  if (existing.ok) return;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${ANKI_MEDIA_BUCKET}/${encodeObjectPath(objectPath)}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body,
  });
  if (response.status === 409) return;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Storage trả về mã ${response.status}`);
  }
}

function encodeObjectPath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function hasZstdMagic(buffer) {
  return buffer?.[0] === 0x28 && buffer?.[1] === 0xb5 && buffer?.[2] === 0x2f && buffer?.[3] === 0xfd;
}

function detectMediaMime(filename, buffer) {
  const extension = path.extname(filename).toLowerCase();
  const byExtension = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  };
  if (byExtension[extension]) return byExtension[extension];
  if (buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer?.[0] === 0xff && buffer?.[1] === 0xd8) return "image/jpeg";
  if (buffer?.subarray(0, 6).toString("ascii").startsWith("GIF8")) return "image/gif";
  if (buffer?.subarray(0, 4).toString("ascii") === "RIFF" && buffer?.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function preferredExtension(filename, mime) {
  const extension = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "");
  if (extension && extension.length <= 8) return extension === ".jpeg" ? ".jpg" : extension;
  return { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/wav": ".wav" }[mime] || "";
}

async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }));
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
    .replace(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi, (_, doubleQuoted, singleQuoted, bare) => {
      const source = doubleQuoted || singleQuoted || bare || "";
      if (/^https?:\/\//i.test(source)) return `<img src="${escapeHtml(source)}" alt="Hình Anki">`;
      const token = Buffer.from(source, "utf8").toString("base64url");
      return `[[ANKI_MEDIA:${token}]]`;
    })
    .replace(/<(?!\/?(?:b|strong|i|em|u|s|br|p|div|ul|ol|li|h1|h2|h3|img)\b)[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
