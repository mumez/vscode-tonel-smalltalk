import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const sourcePath = path.resolve(__dirname, "..", "..", "src", "extension.ts");

test("extension starts the Tonel language client for .st documents", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveServerCommand/);
  assert.match(source, /serverPath/);
  assert.match(source, /language:\s*"tonel-smalltalk"/);
  assert.match(source, /scheme:\s*"file"/);
  assert.match(source, /"tonelSmalltalkLanguageServer"/);
  assert.match(source, /"Tonel Smalltalk Language Server"/);
  assert.match(source, /client\.start\(\)/);
  assert.match(source, /client\.stop\(\)/);
  assert.doesNotMatch(source, /createFileSystemWatcher/);
  assert.doesNotMatch(source, /registerDefinitionProvider/);
});
