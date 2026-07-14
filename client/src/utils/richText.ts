const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "DIV", "UL", "OL", "LI", "H1", "H2", "H3", "IMG"]);

export function toEditorHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) return sanitizeHtml(value);
  return value.split(/\r?\n/).map((line) => line ? `<div>${escapeHtml(line)}</div>` : "<div><br></div>").join("");
}

export function sanitizeHtml(value: string) {
  if (typeof DOMParser === "undefined") return escapeHtml(value);
  const document = new DOMParser().parseFromString(value, "text/html");
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
        const match = attribute.value.match(/text-align\s*:\s*(left|center|right|justify)/i);
        if (match) element.setAttribute("style", `text-align:${match[1].toLowerCase()}`);
        else element.removeAttribute(attribute.name);
      } else element.removeAttribute(attribute.name);
    });
  });
  return document.body.innerHTML;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
