const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "DIV", "UL", "OL", "LI", "H1", "H2", "H3", "SPAN", "IMG"]);

export function toEditorHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) return sanitizeHtml(value);
  const lines = value.split(/\r?\n/);
  // Keep plain text inside a block. This gives the browser a stable editing
  // line so the first Space does not create a stray line break.
  // Browsers serialize a typed space inside contenteditable as `&nbsp;`.
  // Decode that entity before escaping plain text, otherwise it appears as
  // the literal characters "&nbsp;" after a save/re-render.
  const plainLines = lines.map((line) => decodePlainText(line));
  if (plainLines.length === 1) return `<div>${escapeHtml(plainLines[0])}</div>`;
  return plainLines.map((line) => line ? `<div>${escapeHtml(line)}</div>` : "<div><br></div>").join("");
}

export function sanitizeHtml(value: string) {
  if (typeof DOMParser === "undefined") return escapeHtml(value);
  const document = new DOMParser().parseFromString(value, "text/html");
  // execCommand may emit `<font color="…">` for text color. Normalize it to
  // the style form used by our editor before applying the allow-list.
  document.body.querySelectorAll("font").forEach((font) => {
    const span = document.createElement("span");
    const color = font.getAttribute("color");
    if (color) span.setAttribute("style", `color:${color}`);
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
  document.body.querySelectorAll("*").forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    Array.from(element.attributes).forEach((attribute) => {
      if (element.tagName === "IMG" && attribute.name === "src") {
        const src = attribute.value.trim();
        if (/^(data:image\/(png|jpeg|gif|webp);base64,|https?:\/\/)/i.test(src)) element.setAttribute("src", src);
        else element.removeAttribute(attribute.name);
        return;
      }
      if (element.tagName === "IMG" && attribute.name === "alt") return;
      if (attribute.name === "style") {
        const safeStyles = attribute.value.split(";").flatMap((declaration) => {
          const match = declaration.trim().match(/^(text-align|color|background-color)\s*:\s*(.+)$/i);
          if (!match) return [];
          const property = match[1].toLowerCase();
          const value = match[2].trim();
          if (property === "text-align" && /^(left|center|right|justify)$/i.test(value)) return [`text-align:${value.toLowerCase()}`];
          if ((property === "color" || property === "background-color") && /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i.test(value)) return [`${property}:${value}`];
          return [];
        });
        if (safeStyles.length) element.setAttribute("style", safeStyles.join(";"));
        else element.removeAttribute(attribute.name);
      } else element.removeAttribute(attribute.name);
    });
  });
  return document.body.innerHTML;
}

export function toClozeQuestionHtml(value: string) {
  return sanitizeHtml(toEditorHtml(value)).replace(/\{\{c\d+::([\s\S]*?)\}\}/gi, '<span class="cloze-blank" aria-label="Ô điền khuyết">_____</span>');
}

export function toClozeAnswerHtml(value: string) {
  const answers = Array.from(value.matchAll(/\{\{c\d+::([\s\S]*?)\}\}/gi), (match) => {
    const parsed = new DOMParser().parseFromString(match[1], "text/html");
    return (parsed.body.textContent ?? "").trim();
  }).filter(Boolean);
  return answers.map((answer) => `<div>${escapeHtml(answer)}</div>`).join("");
}

export function hasCloze(value: string) {
  return /\{\{c\d+::[\s\S]*?\}\}/i.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function decodePlainText(value: string) {
  // Older saves may contain either `&nbsp;` or the double-encoded
  // `&amp;nbsp;`. Decode twice so those values never reappear as visible text.
  let decoded = value;
  if (typeof DOMParser !== "undefined") {
    for (let pass = 0; pass < 2; pass += 1) {
      const parsed = new DOMParser().parseFromString(decoded, "text/html").body.textContent ?? decoded;
      if (parsed === decoded) break;
      decoded = parsed;
    }
  }
  return decoded.replace(/\u00a0/g, " ");
}
