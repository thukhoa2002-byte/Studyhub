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

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
