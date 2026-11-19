import test from "node:test";
import assert from "node:assert/strict";

import { parsePatch } from "../../src/analyzers/diff-parser.js";

test("should read added and removed lines from a unified diff hunk", () => {
  const patch = [
    "@@ -2,2 +2,3 @@ function login(user)",
    " const user = input;",
    "-return user;",
    "+if (!user) {",
    "+  throw new Error(\"missing user\");",
    "+}",
    "\\ No newline at end of file"
  ].join("\n");

  assert.deepEqual(parsePatch(patch), [
    {
      oldStart: 2,
      oldLines: 2,
      newStart: 2,
      newLines: 3,
      heading: "function login(user)",
      addedLines: [
        "if (!user) {",
        "  throw new Error(\"missing user\");",
        "}"
      ],
      removedLines: ["return user;"]
    }
  ]);
});

test("should return no hunks when the patch is missing", () => {
  assert.deepEqual(parsePatch(null), []);
  assert.deepEqual(parsePatch(""), []);
});
