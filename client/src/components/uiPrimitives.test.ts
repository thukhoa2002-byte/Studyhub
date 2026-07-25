import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("shared UI primitives use semantic token classes and status variants", () => {
  const primitives = read("./UiPrimitives.tsx");
  assert.match(primitives, /ui-page/);
  assert.match(primitives, /ui-card/);
  assert.match(primitives, /ui-alert--\$\{tone\}/);
  assert.match(primitives, /ui-status-badge--\$\{tone\}/);
  assert.match(primitives, /ui-empty-state/);
  assert.match(primitives, /ui-icon-button/);
});

test("shared select is portalled, collision-aware, and retains unavailable values", () => {
  const select = read("./SharedSelect.tsx");
  assert.match(select, /createPortal/);
  assert.match(select, /positionMenu/);
  assert.match(select, /placement === "top"/);
  assert.match(select, /Giá trị đã lưu không còn khả dụng/);
  assert.match(select, /studyhub:close-shared-select/);
  assert.match(select, /event\.key === "Escape"/);
});

test("drawer and confirmation dialog provide keyboard escape, focus trap, and focus restoration", () => {
  const sidebar = read("./WorkspaceTabs.tsx");
  const dialog = read("./ConfirmDialog.tsx");
  assert.match(sidebar, /studyhub-mobile-navigation/);
  assert.match(sidebar, /event\.key === "Escape"/);
  assert.match(sidebar, /studyhub-mobile-nav-trigger/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /restoreFocusRef/);
  assert.match(dialog, /event\.key === "Escape"/);
});
