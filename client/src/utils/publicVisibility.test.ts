import assert from "node:assert/strict";
import test from "node:test";
import { isPublishedStatus, onlyPublished } from "./publicVisibility.ts";

test("public visibility accepts only published", () => {
  assert.equal(isPublishedStatus("published"), true);
  assert.equal(isPublishedStatus("draft"), false);
  assert.equal(isPublishedStatus("reviewed"), false);
  assert.equal(isPublishedStatus("in_review"), false);
  assert.equal(isPublishedStatus("archived"), false);
});

test("onlyPublished removes every non-public record", () => {
  const records = [{ id: "draft", status: "draft" }, { id: "old", status: "archived" }, { id: "live", status: "published" }];
  assert.deepEqual(onlyPublished(records), [{ id: "live", status: "published" }]);
});
