import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("official StudyHub brand assets are the approved PNG files", () => {
  for (const asset of [
    "../../../public/branding/studyhub-logo.png",
    "../../../public/branding/studyhub-icon.png",
    "../../../public/branding/studyhub-icon-16.png",
    "../../../public/branding/studyhub-icon-32.png",
    "../../../public/branding/studyhub-icon-48.png",
    "../../../public/branding/studyhub-icon-180.png",
    "../../../public/branding/studyhub-icon-192.png",
    "../../../public/branding/studyhub-icon-512.png",
    "../../../public/branding/studyhub-favicon-v3.ico",
    "../../../public/branding/studyhub-favicon-v3-16.png",
    "../../../public/branding/studyhub-favicon-v3-32.png",
    "../../../public/branding/studyhub-favicon-v3-48.png",
    "../../../public/branding/studyhub-apple-touch-icon-v3.png",
    "../../../public/branding/studyhub-pwa-icon-v3-192.png",
    "../../../public/branding/studyhub-pwa-icon-v3-512.png",
  ]) assert.equal(existsSync(new URL(asset, import.meta.url)), true, `${asset} is missing`);
});

test("shared branding components preserve source assets and contain sizing", () => {
  const brandLogo = read("./BrandLogo.tsx");
  const brandAssets = read("./brandAssets.ts");
  assert.match(brandLogo, /variant\?: "full" \| "icon"/);
  assert.match(brandLogo, /StudyHub — Learn\. Connect\. Apply\./);
  assert.match(brandLogo, /object-contain/);
  assert.match(brandAssets, /\/branding\/studyhub-logo\.png/);
  assert.match(brandAssets, /\/branding\/studyhub-icon\.png/);
  assert.doesNotMatch(`${brandLogo}\n${brandAssets}`, /filter|mask-image|object-cover/);
});

test("shells and metadata reference the approved assets", () => {
  const header = read("../Header.tsx");
  const sidebar = read("../WorkspaceTabs.tsx");
  const admin = read("../AdminLayout.tsx");
  const app = read("../../App.tsx");
  const html = read("../../../index.html");
  const manifest = read("../../../public/manifest.webmanifest");
  assert.match(header, /StudyHubIcon/);
  assert.match(sidebar, /StudyHubIcon[\s\S]*StudyHubLogo/);
  assert.match(admin, /StudyHubLogo/);
  assert.match(app, /BrandLogo variant="full"/);
  assert.match(html, /\/branding\/studyhub-favicon-v3\.ico/);
  assert.match(html, /\/branding\/studyhub-favicon-v3-32\.png/);
  assert.match(html, /\/branding\/studyhub-apple-touch-icon-v3\.png/);
  assert.match(manifest, /\/branding\/studyhub-pwa-icon-v3-192\.png/);
  assert.match(manifest, /\/branding\/studyhub-pwa-icon-v3-512\.png/);
  assert.doesNotMatch(`${header}\n${sidebar}\n${admin}`, /hoc-bai-icon|brain-learning-icon/);
});
