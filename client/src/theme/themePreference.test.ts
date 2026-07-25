import assert from "node:assert/strict";
import test from "node:test";
import { canUseColorTheme } from "../config/access.ts";
import { defaultTheme, isAppTheme } from "./themeTypes.ts";
import { sanitizeThemePreference, themePreferenceKey } from "./themePreference.ts";

test("only known administrators and the designated account can use Color", () => {
  assert.equal(canUseColorTheme(" thukhoa2002@gmail.com "), true);
  assert.equal(canUseColorTheme("TOTENTU162@GMAIL.COM"), true);
  assert.equal(canUseColorTheme("member@example.com"), false);
  assert.equal(canUseColorTheme(null), false);
});

test("theme preference keys are isolated by normalized identity", () => {
  assert.equal(themePreferenceKey("TOTENTU162@GMAIL.COM"), "studyhub:theme:totentu162@gmail.com");
  assert.notEqual(themePreferenceKey("admin@example.com"), themePreferenceKey("member@example.com"));
  assert.equal(themePreferenceKey(null), null);
});

test("only Default and Color are valid runtime themes", () => {
  assert.equal(defaultTheme, "default");
  assert.equal(isAppTheme("default"), true);
  assert.equal(isAppTheme("color"), true);
  assert.equal(isAppTheme("green"), false);
});

test("Color is rejected for guests and normal users even when a preference is supplied", () => {
  assert.equal(sanitizeThemePreference("color", false), "default");
  assert.equal(sanitizeThemePreference("color", true), "color");
  assert.equal(sanitizeThemePreference("test", true), "default");
});
