import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("official StudyHub brand assets are static SVG files", () => {
  assert.equal(existsSync(new URL("../../../public/brand/studyhub-logo.svg", import.meta.url)), true);
  assert.equal(existsSync(new URL("../../../public/brand/studyhub-icon.svg", import.meta.url)), true);
  assert.match(read("../../../public/brand/studyhub-logo.svg"), /<svg[\s>]/);
  assert.match(read("../../../public/brand/studyhub-icon.svg"), /<svg[\s>]/);
});

test("shared branding components preserve source assets and contain sizing", () => {
  const logo = read("./StudyHubLogo.tsx");
  const icon = read("./StudyHubIcon.tsx");
  assert.match(logo, /\/brand\/studyhub-logo\.svg/);
  assert.match(icon, /\/brand\/studyhub-icon\.svg/);
  assert.match(logo, /object-contain/);
  assert.match(icon, /object-contain/);
  assert.doesNotMatch(logo, /filter|mask-image|object-cover/);
  assert.doesNotMatch(icon, /filter|mask-image|object-cover/);
});

test("shells and metadata reference the approved assets", () => {
  const header = read("../Header.tsx");
  const sidebar = read("../WorkspaceTabs.tsx");
  const admin = read("../AdminLayout.tsx");
  const html = read("../../../index.html");
  const manifest = read("../../../public/manifest.webmanifest");
  assert.match(header, /StudyHubIcon/);
  assert.match(sidebar, /StudyHubIcon[\s\S]*StudyHubLogo/);
  assert.match(admin, /StudyHubLogo/);
  assert.match(html, /\/brand\/studyhub-icon\.svg/);
  assert.match(manifest, /\/brand\/studyhub-icon\.svg/);
  assert.doesNotMatch(`${header}\n${sidebar}\n${admin}`, /hoc-bai-icon|brain-learning-icon/);
});
