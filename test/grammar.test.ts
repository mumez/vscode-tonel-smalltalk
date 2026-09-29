import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import type { IToken } from "vscode-textmate";

const root = path.resolve(__dirname, "..", "..");
const grammarPath = path.join(
  root,
  "syntaxes",
  "tonel-smalltalk.tmLanguage.json"
);

async function loadGrammar() {
  const vscodeTextmate = await import("vscode-textmate");
  const vscodeOniguruma = await import("vscode-oniguruma");
  const wasmBytes = fs.readFileSync(
    createRequire(__filename).resolve("vscode-oniguruma/release/onig.wasm")
  );
  const wasm = wasmBytes.buffer.slice(
    wasmBytes.byteOffset,
    wasmBytes.byteOffset + wasmBytes.byteLength
  );
  await vscodeOniguruma.loadWASM(wasm);

  const registry = new vscodeTextmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns: string[]) =>
        new vscodeOniguruma.OnigScanner(patterns),
      createOnigString: (value: string) => new vscodeOniguruma.OnigString(value)
    }),
    loadGrammar: async (scopeName: string) => {
      if (scopeName !== "source.tonel-smalltalk") {
        return null;
      }
      return vscodeTextmate.parseRawGrammar(
        fs.readFileSync(grammarPath, "utf8"),
        grammarPath
      );
    }
  });

  const grammar = await registry.loadGrammar("source.tonel-smalltalk");
  if (!grammar) {
    throw new Error("grammar failed to load");
  }
  return grammar;
}

function scopesAt(tokens: IToken[], line: string, substring: string): string[] {
  const start = line.indexOf(substring);
  assert.notEqual(start, -1, `missing substring ${substring} in ${line}`);
  const token = tokens.find(
    (candidate) => candidate.startIndex <= start && start < candidate.endIndex
  );
  assert.ok(token, `no token covers ${substring}`);
  return token.scopes;
}

test("Tonel sample receives Smalltalk token scopes", async () => {
  const grammar = await loadGrammar();

  const cases: Array<{ line: string; substring: string; scope: string }> = [
    { line: "Class {", substring: "Class", scope: "keyword.other.tonel" },
    { line: '"comment"', substring: "comment", scope: "comment.block.smalltalk" },
    {
      line: "'Kernel-Objects'",
      substring: "Kernel-Objects",
      scope: "string.quoted.single.smalltalk"
    },
    {
      line: "'ab''c'",
      substring: "''",
      scope: "constant.character.escape.smalltalk"
    },
    { line: "#Point", substring: "#Point", scope: "constant.other.symbol.smalltalk" },
    {
      line: "#'Kernel-BasicObjects'",
      substring: "#'Kernel-BasicObjects'",
      scope: "constant.other.symbol.smalltalk"
    },
    { line: "self", substring: "self", scope: "keyword.control.smalltalk" },
    { line: "^ x", substring: "^", scope: "keyword.operator.return.smalltalk" },
    {
      line: "x := 42.",
      substring: ":=",
      scope: "keyword.operator.assignment.smalltalk"
    },
    { line: "x := 42.", substring: "42", scope: "constant.numeric.smalltalk" },
    {
      line: "x := 42.",
      substring: ".",
      scope: "punctuation.terminator.statement.smalltalk"
    },
    { line: "Point", substring: "Point", scope: "entity.name.type.class.smalltalk" },
    {
      line: "value: arg",
      substring: "value:",
      scope: "entity.name.function.smalltalk"
    },
    { line: "$a", substring: "$a", scope: "constant.language.character.smalltalk" },
    {
      line: "<primitive: 1>",
      substring: "primitive",
      scope: "meta.pragma.smalltalk"
    }
  ];

  for (const entry of cases) {
    const tokens = grammar.tokenizeLine(entry.line, null).tokens;
    assert.ok(
      scopesAt(tokens, entry.line, entry.substring).includes(entry.scope),
      `${entry.substring} should include ${entry.scope}`
    );
  }
});

test("a mid-line comparison is not a pragma", async () => {
  const grammar = await loadGrammar();
  const line = "a < b";
  const tokens = grammar.tokenizeLine(line, null).tokens;
  const scopes = scopesAt(tokens, line, "<");
  assert.equal(scopes.includes("meta.pragma.smalltalk"), false);
});
