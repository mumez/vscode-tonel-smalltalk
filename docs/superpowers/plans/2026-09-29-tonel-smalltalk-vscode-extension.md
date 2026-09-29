# Tonel Smalltalk VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a VS Code extension that treats `.st` files as Tonel Smalltalk: TextMate highlighting plus a stdio client for `tonel-smalltalk-language-server`.

**Architecture:** The extension contributes a language id, a language configuration, and a TextMate grammar. On activation it resolves a server command and starts `vscode-languageclient`, which speaks LSP over stdin/stdout. Definition, references, hover, and syntax diagnostics are provided by the server; the extension does not implement those features itself. The server binary is not bundled.

**Tech Stack:** TypeScript 5, Node 20, VS Code engine `^1.85.0`, `vscode-languageclient` 9, `node:test`, `vscode-textmate`, `vscode-oniguruma`.

## Global Constraints

- Language id is `tonel-smalltalk`. Do not register `smalltalk`. The server understands Tonel (`Class`, `Trait`, `Extension`, `Package`), and a generic `smalltalk` id collides with other extensions.
- The only filename association is `.st`.
- Grammar scope name is `source.tonel-smalltalk`.
- Server executable name is `tonel-smalltalk-language-server`. On Windows, the `node_modules/.bin` lookup uses `tonel-smalltalk-language-server.cmd`.
- Transport is stdio. The server in `tonel-smalltalk-language-server` `lsp/src/main.rs` reads stdin and writes stdout. Do not pass a port or a socket.
- Do not register a `createFileSystemWatcher`. The server has no `workspace/didChangeWatchedFiles` handler. It scans `rootUri` during `initialized` and updates open documents through `textDocument/didOpen` and `textDocument/didChange`.
- Do not implement `DefinitionProvider`, `ReferenceProvider`, `HoverProvider`, or a diagnostic collection. The server advertises definition, references, and hover, and it publishes syntax diagnostics itself.
- Do not download or vendor the language server. Resolution order is settings, then `node_modules/.bin`, then `PATH`.
- VS Code engine is `^1.85.0`. `@types/vscode` is `^1.85.0`. `vscode-languageclient` is `^9.0.1`.
- Do not run `yo code`. Write the files in this plan so the scaffold is deterministic.
- Documents and code comments are in English.
- Open the folder that contains the Tonel sources before expecting go-to-definition. The server indexes that workspace root.

## File Structure

| Path | Responsibility |
| --- | --- |
| `package.json` | Extension manifest: language, grammar, settings, scripts |
| `tsconfig.json` | Compile `src/` to `dist/` |
| `tsconfig.test.json` | Compile `src/` and `test/` to `dist-test/` |
| `language-configuration.json` | Comments, brackets, auto-close pairs |
| `syntaxes/tonel-smalltalk.tmLanguage.json` | TextMate highlighting |
| `src/serverCommand.ts` | Pure server-command resolution |
| `src/extension.ts` | Activate and stop the language client |
| `test/packageManifest.test.ts` | Manifest and language-configuration contract |
| `test/grammar.test.ts` | Token scope checks |
| `test/serverCommand.test.ts` | Command-resolution checks |
| `test/extensionWiring.test.ts` | Activation source contract |
| `.vscode/launch.json` | F5 Extension Development Host |
| `.vscode/tasks.json` | Background `npm run watch` |
| `.vscode/settings.example.json` | Local server-path example, not machine state |
| `.vscodeignore` | Keep sources and tests out of the VSIX |
| `.gitignore` | Ignore install output and local settings |
| `README.md` | Build, configure, and manually verify |

---

### Task 1: Package manifest and language configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.test.json`
- Create: `language-configuration.json`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `test/packageManifest.test.ts`
- Test: `test/packageManifest.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: language id `tonel-smalltalk`, grammar path `./syntaxes/tonel-smalltalk.tmLanguage.json`, settings `tonelSmalltalk.serverProjectPath` and `tonelSmalltalk.serverPath`, npm script `test` that compiles `tsconfig.test.json` and runs `node --test dist-test/test/*.test.js`

- [ ] **Step 1: Write the failing manifest test**

Create `test/packageManifest.test.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "..", "..");

test("package.json contributes Tonel Smalltalk for .st files", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ) as {
    name: string;
    main: string;
    engines: { vscode: string };
    contributes: {
      languages: Array<{
        id: string;
        extensions: string[];
        configuration: string;
      }>;
      grammars: Array<{ language: string; scopeName: string; path: string }>;
      configuration: {
        properties: Record<string, { type: string; default: string }>;
      };
    };
  };

  assert.equal(manifest.name, "vscode-tonel-smalltalk");
  assert.equal(manifest.main, "./dist/extension.js");
  assert.equal(manifest.engines.vscode, "^1.85.0");
  assert.equal(manifest.contributes.languages[0].id, "tonel-smalltalk");
  assert.deepEqual(manifest.contributes.languages[0].extensions, [".st"]);
  assert.equal(
    manifest.contributes.languages[0].configuration,
    "./language-configuration.json"
  );
  assert.equal(manifest.contributes.grammars[0].language, "tonel-smalltalk");
  assert.equal(
    manifest.contributes.grammars[0].scopeName,
    "source.tonel-smalltalk"
  );
  assert.equal(
    manifest.contributes.grammars[0].path,
    "./syntaxes/tonel-smalltalk.tmLanguage.json"
  );
  assert.equal(
    manifest.contributes.configuration.properties[
      "tonelSmalltalk.serverProjectPath"
    ].type,
    "string"
  );
  assert.equal(
    manifest.contributes.configuration.properties["tonelSmalltalk.serverPath"]
      .default,
    ""
  );
});

test("language configuration uses Smalltalk comment and bracket pairs", () => {
  const configuration = JSON.parse(
    fs.readFileSync(path.join(root, "language-configuration.json"), "utf8")
  ) as {
    comments: { blockComment: [string, string] };
    brackets: string[][];
  };

  assert.deepEqual(configuration.comments.blockComment, ['"', '"']);
  assert.deepEqual(configuration.brackets, [
    ["[", "]"],
    ["(", ")"],
    ["{", "}"]
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `package.json` does not exist yet (`ENOENT` or `npm` has no `test` script).

- [ ] **Step 3: Write the scaffold files**

Create `package.json`:

```json
{
  "name": "vscode-tonel-smalltalk",
  "displayName": "Tonel Smalltalk",
  "description": "Tonel Smalltalk language support for .st files",
  "version": "0.0.1",
  "publisher": "mumez",
  "license": "MIT",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Programming Languages"
  ],
  "keywords": [
    "smalltalk",
    "tonel",
    "lsp"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [
      {
        "id": "tonel-smalltalk",
        "aliases": [
          "Tonel Smalltalk",
          "Tonel"
        ],
        "extensions": [
          ".st"
        ],
        "configuration": "./language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "tonel-smalltalk",
        "scopeName": "source.tonel-smalltalk",
        "path": "./syntaxes/tonel-smalltalk.tmLanguage.json"
      }
    ],
    "configuration": {
      "title": "Tonel Smalltalk",
      "properties": {
        "tonelSmalltalk.serverProjectPath": {
          "type": "string",
          "default": "",
          "description": "Absolute path to the tonel-smalltalk-language-server project directory. When set, the extension runs cargo run --release --manifest-path <path>/Cargo.toml."
        },
        "tonelSmalltalk.serverPath": {
          "type": "string",
          "default": "",
          "description": "Absolute path to the tonel-smalltalk-language-server executable. Used when serverProjectPath is empty. When this is also empty, the extension tries node_modules/.bin and then PATH."
        }
      }
    }
  },
  "scripts": {
    "compile": "tsc -p tsconfig.json",
    "watch": "tsc -w -p tsconfig.json",
    "test": "tsc -p tsconfig.test.json && node --test dist-test/test/*.test.js",
    "vscode:prepublish": "npm run compile"
  },
  "dependencies": {
    "vscode-languageclient": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/vscode": "^1.85.0",
    "typescript": "^5.4.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "dist-test"]
}
```

Create `tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist-test",
    "rootDir": "."
  },
  "include": ["src", "test"],
  "exclude": ["node_modules", "dist", "dist-test"]
}
```

Create `language-configuration.json`:

```json
{
  "comments": {
    "blockComment": ["\"", "\""]
  },
  "brackets": [
    ["[", "]"],
    ["(", ")"],
    ["{", "}"]
  ],
  "autoClosingPairs": [
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" },
    { "open": "{", "close": "}" },
    { "open": "'", "close": "'", "notIn": ["comment", "string"] }
  ],
  "surroundingPairs": [
    ["[", "]"],
    ["(", ")"],
    ["{", "}"],
    ["'", "'"],
    ["\"", "\""]
  ]
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
dist-test/
*.vsix
.vscode/settings.json
```

Create `.vscodeignore`:

```gitignore
.vscode/**
**/*.ts
**/*.map
.gitignore
**/tsconfig.json
tsconfig.test.json
**/.git/**
src/**
test/**
dist-test/**
docs/**
draft-plan-ja.md
AGENTS.md
.superpowers/**
node_modules/**
!node_modules/vscode-jsonrpc/**
!node_modules/vscode-languageclient/**
!node_modules/vscode-languageserver-protocol/**
!node_modules/vscode-languageserver-types/**
!node_modules/{minimatch,brace-expansion,concat-map,balanced-match}/**
!node_modules/{semver,lru-cache,yallist}/**
```

`node_modules` is ignored, then the language client and its runtime dependencies are re-included. That is the [lsp-sample `.vscodeignore`](https://github.com/microsoft/vscode-extension-samples/blob/main/lsp-sample/.vscodeignore), with `client/node_modules` rewritten to `node_modules` because this extension has no `client/` package.

`npm test` compiles `tsconfig.test.json`, which includes `test/`. `src/` can be absent until Task 3. Do not run `npm run compile` in this task; `tsconfig.json` uses `"rootDir": "src"` and has no TypeScript files yet.

- [ ] **Step 4: Install and run the test**

Run:

```bash
npm install
npm test
```

Expected: PASS, two tests.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.test.json language-configuration.json .gitignore .vscodeignore test/packageManifest.test.ts
git commit -m "$(cat <<'EOF'
Add the Tonel Smalltalk extension manifest.

Register .st files as tonel-smalltalk so later tasks can attach a grammar and a language client.
EOF
)"
```

---

### Task 2: TextMate grammar

**Files:**
- Create: `syntaxes/tonel-smalltalk.tmLanguage.json`
- Create: `test/grammar.test.ts`
- Modify: `package.json` devDependencies
- Test: `test/grammar.test.ts`

**Interfaces:**
- Consumes: grammar path `./syntaxes/tonel-smalltalk.tmLanguage.json` and scope `source.tonel-smalltalk` from Task 1
- Produces: scopes `comment.block.smalltalk`, `string.quoted.single.smalltalk`, `constant.character.escape.smalltalk`, `constant.other.symbol.smalltalk`, `meta.pragma.smalltalk`, `keyword.control.smalltalk`, `keyword.other.tonel`, `constant.numeric.smalltalk`, `constant.language.character.smalltalk`, `keyword.operator.assignment.smalltalk`, `keyword.operator.return.smalltalk`, `punctuation.terminator.statement.smalltalk`, `entity.name.type.class.smalltalk`, `entity.name.function.smalltalk`

- [ ] **Step 1: Install the grammar test libraries**

Run:

```bash
npm install --save-dev vscode-textmate vscode-oniguruma
```

Expected: `package.json` and `package-lock.json` list both packages under `devDependencies`.

- [ ] **Step 2: Write the failing grammar test**

Create `test/grammar.test.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import type { IToken } from "vscode-textmate";

const require = createRequire(__filename);
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
    require.resolve("vscode-oniguruma/release/onig.wasm")
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL while loading `syntaxes/tonel-smalltalk.tmLanguage.json` (`ENOENT`).

- [ ] **Step 4: Write the grammar**

Create `syntaxes/tonel-smalltalk.tmLanguage.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  "name": "Tonel Smalltalk",
  "scopeName": "source.tonel-smalltalk",
  "patterns": [
    { "include": "#comments" },
    { "include": "#strings" },
    { "include": "#symbols" },
    { "include": "#pragmas" },
    { "include": "#keywords" },
    { "include": "#literals" },
    { "include": "#operators" },
    { "include": "#classes" }
  ],
  "repository": {
    "comments": {
      "patterns": [
        {
          "name": "comment.block.smalltalk",
          "begin": "\"",
          "end": "\""
        }
      ]
    },
    "strings": {
      "patterns": [
        {
          "name": "string.quoted.single.smalltalk",
          "begin": "'",
          "end": "'",
          "patterns": [
            {
              "match": "''",
              "name": "constant.character.escape.smalltalk"
            }
          ]
        }
      ]
    },
    "symbols": {
      "patterns": [
        {
          "name": "constant.other.symbol.smalltalk",
          "match": "#(?:[A-Za-z_][A-Za-z0-9_]*|[+\\-*/=~<>@%|&?!,]+|'[^']*')"
        }
      ]
    },
    "pragmas": {
      "patterns": [
        {
          "name": "meta.pragma.smalltalk",
          "begin": "^\\s*<",
          "end": ">",
          "patterns": [
            {
              "match": "[A-Za-z_][A-Za-z0-9_]*",
              "name": "entity.name.function.smalltalk"
            }
          ]
        }
      ]
    },
    "keywords": {
      "patterns": [
        {
          "name": "keyword.control.smalltalk",
          "match": "\\b(?:self|super|nil|true|false|thisContext)\\b"
        },
        {
          "name": "keyword.other.tonel",
          "match": "\\b(?:Class|Trait|Extension|Package)\\b"
        }
      ]
    },
    "literals": {
      "patterns": [
        {
          "name": "constant.numeric.smalltalk",
          "match": "\\b(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[edq]-?[0-9]+)?\\b"
        },
        {
          "name": "constant.language.character.smalltalk",
          "match": "\\$\\S"
        }
      ]
    },
    "operators": {
      "patterns": [
        {
          "name": "keyword.operator.assignment.smalltalk",
          "match": ":="
        },
        {
          "name": "keyword.operator.return.smalltalk",
          "match": "\\^"
        },
        {
          "name": "punctuation.terminator.statement.smalltalk",
          "match": "\\."
        },
        {
          "name": "punctuation.separator.smalltalk",
          "match": ";"
        }
      ]
    },
    "classes": {
      "patterns": [
        {
          "name": "entity.name.type.class.smalltalk",
          "match": "\\b[A-Z][A-Za-z0-9_]*\\b"
        },
        {
          "name": "entity.name.function.smalltalk",
          "match": "\\b[a-z][A-Za-z0-9_]*:(?!=)"
        }
      ]
    }
  }
}
```

Pragmas match only at the start of a line, after optional whitespace. A comparison such as `a < b` stays unscoped as a pragma. Keyword rules are listed before the capitalized-identifier rule, so `Class` is `keyword.other.tonel`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`

Expected: PASS, including the Task 1 tests and both grammar tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json syntaxes/tonel-smalltalk.tmLanguage.json test/grammar.test.ts
git commit -m "$(cat <<'EOF'
Highlight Tonel Smalltalk with a TextMate grammar.

Cover comments, strings, symbols, line-start pragmas, keywords, and class names without treating comparisons as pragmas.
EOF
)"
```

---

### Task 3: Server command resolution

**Files:**
- Create: `src/serverCommand.ts`
- Create: `test/serverCommand.test.ts`
- Test: `test/serverCommand.test.ts`

**Interfaces:**
- Consumes: setting names `tonelSmalltalk.serverProjectPath` and `tonelSmalltalk.serverPath` from Task 1. This module does not read VS Code settings; the caller passes the strings.
- Produces:

```typescript
export interface ServerLaunchConfig {
  serverProjectPath: string;
  serverPath: string;
  platform: NodeJS.Platform;
  extensionPath: string;
  fileExists: (candidate: string) => boolean;
}

export interface ServerCommand {
  command: string;
  args: string[];
}

export function resolveServerCommand(config: ServerLaunchConfig): ServerCommand;
```

Resolution order:

1. Non-blank `serverProjectPath` returns `cargo` with args `["run", "--release", "--manifest-path", "<path>/Cargo.toml"]`.
2. Non-blank `serverPath` returns that string and `args: []`, even when the file is missing.
3. If `fileExists` is true for `<extensionPath>/node_modules/.bin/<binary>`, return that path.
4. Otherwise return command `tonel-smalltalk-language-server` and `args: []`.

`<binary>` is `tonel-smalltalk-language-server.cmd` when `platform` is `win32`, otherwise `tonel-smalltalk-language-server`.

- [ ] **Step 1: Write the failing test**

Create `test/serverCommand.test.ts`:

```typescript
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  resolveServerCommand,
  type ServerLaunchConfig
} from "../src/serverCommand";

function config(overrides: Partial<ServerLaunchConfig> = {}): ServerLaunchConfig {
  return {
    serverProjectPath: "",
    serverPath: "",
    platform: "linux",
    extensionPath: "/ext",
    fileExists: () => false,
    ...overrides
  };
}

test("serverProjectPath runs cargo against that Cargo.toml", () => {
  const command = resolveServerCommand(
    config({ serverProjectPath: "  /srv/tonel-smalltalk-language-server  " })
  );

  assert.equal(command.command, "cargo");
  assert.deepEqual(command.args, [
    "run",
    "--release",
    "--manifest-path",
    path.join("/srv/tonel-smalltalk-language-server", "Cargo.toml")
  ]);
});

test("serverPath wins over a local binary and PATH", () => {
  const command = resolveServerCommand(
    config({
      serverPath: "/opt/tonel-smalltalk-language-server",
      fileExists: () => true
    })
  );

  assert.deepEqual(command, {
    command: "/opt/tonel-smalltalk-language-server",
    args: []
  });
});

test("a configured serverPath is kept when the file is missing", () => {
  const command = resolveServerCommand(
    config({ serverPath: "/missing/tonel-smalltalk-language-server" })
  );

  assert.equal(command.command, "/missing/tonel-smalltalk-language-server");
});

test("an existing local binary is used before PATH", () => {
  const localBin = path.join(
    "/ext",
    "node_modules",
    ".bin",
    "tonel-smalltalk-language-server"
  );
  const command = resolveServerCommand(
    config({
      fileExists: (candidate) => candidate === localBin
    })
  );

  assert.deepEqual(command, { command: localBin, args: [] });
});

test("Windows looks for the npm cmd shim", () => {
  const localBin = path.join(
    "/ext",
    "node_modules",
    ".bin",
    "tonel-smalltalk-language-server.cmd"
  );
  const command = resolveServerCommand(
    config({
      platform: "win32",
      fileExists: (candidate) => candidate === localBin
    })
  );

  assert.equal(command.command, localBin);
});

test("PATH is the fallback", () => {
  const command = resolveServerCommand(config());

  assert.deepEqual(command, {
    command: "tonel-smalltalk-language-server",
    args: []
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL with `TS2307: Cannot find module '../src/serverCommand'`.

- [ ] **Step 3: Write the resolver**

Create `src/serverCommand.ts`:

```typescript
import * as path from "node:path";

export interface ServerLaunchConfig {
  serverProjectPath: string;
  serverPath: string;
  platform: NodeJS.Platform;
  extensionPath: string;
  fileExists: (candidate: string) => boolean;
}

export interface ServerCommand {
  command: string;
  args: string[];
}

function binaryName(platform: NodeJS.Platform): string {
  return platform === "win32"
    ? "tonel-smalltalk-language-server.cmd"
    : "tonel-smalltalk-language-server";
}

export function resolveServerCommand(config: ServerLaunchConfig): ServerCommand {
  const projectPath = config.serverProjectPath.trim();
  if (projectPath.length > 0) {
    return {
      command: "cargo",
      args: [
        "run",
        "--release",
        "--manifest-path",
        path.join(projectPath, "Cargo.toml")
      ]
    };
  }

  const configuredPath = config.serverPath.trim();
  if (configuredPath.length > 0) {
    return { command: configuredPath, args: [] };
  }

  const localBin = path.join(
    config.extensionPath,
    "node_modules",
    ".bin",
    binaryName(config.platform)
  );
  if (config.fileExists(localBin)) {
    return { command: localBin, args: [] };
  }

  return { command: "tonel-smalltalk-language-server", args: [] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/serverCommand.ts test/serverCommand.test.ts
git commit -m "$(cat <<'EOF'
Resolve the Tonel language server command from settings.

Prefer a Cargo project path, then an explicit binary, then node_modules/.bin, then PATH.
EOF
)"
```

---

### Task 4: Language client activation

**Files:**
- Create: `src/extension.ts`
- Create: `test/extensionWiring.test.ts`
- Test: `test/extensionWiring.test.ts`

**Interfaces:**
- Consumes: `resolveServerCommand(config: ServerLaunchConfig): ServerCommand` from Task 3. Settings keys `tonelSmalltalk.serverProjectPath` and `tonelSmalltalk.serverPath`.
- Produces: `activate(context: vscode.ExtensionContext): Promise<void>` and `deactivate(): Promise<void>`. The client id is `tonelSmalltalkLanguageServer`. The client display name is `Tonel Smalltalk Language Server`. `documentSelector` is `[{ scheme: "file", language: "tonel-smalltalk" }]`.

- [ ] **Step 1: Write the failing wiring test**

Create `test/extensionWiring.test.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const sourcePath = path.resolve(__dirname, "..", "..", "src", "extension.ts");

test("extension starts the Tonel language client for .st documents", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveServerCommand/);
  assert.match(source, /serverProjectPath/);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL with `ENOENT` for `src/extension.ts`.

- [ ] **Step 3: Write the extension entry point**

Create `src/extension.ts`:

```typescript
import * as fs from "node:fs";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from "vscode-languageclient/node";
import { resolveServerCommand } from "./serverCommand";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("tonelSmalltalk");
  const server = resolveServerCommand({
    serverProjectPath: config.get<string>("serverProjectPath") ?? "",
    serverPath: config.get<string>("serverPath") ?? "",
    platform: process.platform,
    extensionPath: context.extensionPath,
    fileExists: fs.existsSync
  });

  const executable = { command: server.command, args: server.args };
  const serverOptions: ServerOptions = {
    run: executable,
    debug: executable
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "tonel-smalltalk" }]
  };

  client = new LanguageClient(
    "tonelSmalltalkLanguageServer",
    "Tonel Smalltalk Language Server",
    serverOptions,
    clientOptions
  );

  await client.start();
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return;
  }

  await client.stop();
  client = undefined;
}
```

`deactivate` owns `client.stop()`. Do not also push `client` onto `context.subscriptions`, which would stop it a second time.

Opening a `.st` file activates the extension because `package.json` contributes the `tonel-smalltalk` language. Do not add an `activationEvents` entry.

- [ ] **Step 4: Run the tests and compile the extension**

Run:

```bash
npm test
npm run compile
```

Expected: PASS, and `dist/extension.js` exists.

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts test/extensionWiring.test.ts
git commit -m "$(cat <<'EOF'
Start the Tonel language server when a .st file activates the extension.

The client enables definition, references, hover, and diagnostics by connecting over stdio.
EOF
)"
```

---

### Task 5: Extension Development Host and VSIX package

**Files:**
- Create: `.vscode/launch.json`
- Create: `.vscode/tasks.json`
- Create: `.vscode/settings.example.json`
- Create: `README.md`
- Modify: `package.json` scripts
- Test: `npm test`, `npm run compile`, `npx --yes @vscode/vsce package`

**Interfaces:**
- Consumes: `npm run watch`, `npm run compile`, and the settings from Task 1. The client from Task 4.
- Produces: launch configuration `Run Extension`, npm script `package`, and `vscode-tonel-smalltalk-0.0.1.vsix`.

- [ ] **Step 1: Add the package script test to the manifest test**

In `test/packageManifest.test.ts`, extend the manifest type with `scripts: { package: string; "vscode:prepublish": string }` and add these assertions inside the existing manifest test:

```typescript
  assert.equal(manifest.scripts["vscode:prepublish"], "npm run compile");
  assert.equal(manifest.scripts.package, "vsce package");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `scripts.package` is undefined.

- [ ] **Step 3: Add launch files, the package script, and the README**

In `package.json`, add this scripts entry next to `vscode:prepublish`:

```json
"package": "vsce package"
```

Install the packager as a dev dependency:

```bash
npm install --save-dev @vscode/vsce
```

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": {
        "reveal": "never"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

Create `.vscode/settings.example.json`:

```json
{
  "tonelSmalltalk.serverProjectPath": "/absolute/path/to/tonel-smalltalk-language-server"
}
```

Do not commit `.vscode/settings.json`. Copy the example locally when a machine-specific path is needed.

Create `README.md`:

```markdown
# Tonel Smalltalk for VS Code

Editor support for Tonel `.st` files. Highlighting lives in this extension. Navigation and syntax diagnostics come from [tonel-smalltalk-language-server](https://github.com/mumez/tonel-smalltalk-language-server) over stdio.

## Features

- Syntax highlighting for comments, strings, symbols, pragmas, Tonel keywords, and class names
- Go to Definition (F12)
- Find All References (Shift+F12)
- Hover for class, trait, and variable information
- Syntax-error diagnostics

The language server implements those LSP methods. This extension does not reimplement them.

## Requirements

- VS Code 1.85 or newer
- A built `tonel-smalltalk-language-server` binary, or a Rust toolchain when using `tonelSmalltalk.serverProjectPath`
- A workspace folder that contains the Tonel sources. The server indexes that folder on startup.

## Develop

```bash
npm install
npm test
npm run compile
```

Press F5 and choose **Run Extension**.

## Server command

The extension picks the first match:

1. `tonelSmalltalk.serverProjectPath`: `cargo run --release --manifest-path <path>/Cargo.toml`
2. `tonelSmalltalk.serverPath`: that executable
3. `node_modules/.bin/tonel-smalltalk-language-server` when it exists
4. `tonel-smalltalk-language-server` on `PATH`

Build the server in its own repository:

```bash
cargo build --release
```

The release binary is `target/release/tonel-smalltalk-language-server`. Point `tonelSmalltalk.serverPath` at it, or copy it onto `PATH`.

Startup logs are in the **Tonel Smalltalk Language Server** output channel. A successful index logs `Workspace scan complete`.

## Package

```bash
npm run package
```

This produces `vscode-tonel-smalltalk-0.0.1.vsix`. Install it from the VS Code Extensions view with **Install from VSIX**.

## Manual check

1. Build the language server and set `tonelSmalltalk.serverPath` or `tonelSmalltalk.serverProjectPath`.
2. Press F5 in this repository.
3. In the Extension Development Host, open a folder of `.st` files.
4. Confirm comments, strings, symbols, and class names are colored.
5. Put the cursor on a class name and press F12. The editor opens that class definition.
6. Press Shift+F12 and confirm the references list.
7. Hover a class name and confirm the hover shows class information.
8. Insert a syntax error and confirm a diagnostic appears.
9. Confirm the output channel logs `Workspace scan complete`.
```

- [ ] **Step 4: Run tests, compile, and pack**

Run:

```bash
npm test
npm run compile
npm run package
```

Expected: tests PASS, `dist/extension.js` exists, and `vscode-tonel-smalltalk-0.0.1.vsix` is created. `vsce` may warn that there is no `repository` or `LICENSE` file. A warning is acceptable. A non-zero exit is not.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json test/packageManifest.test.ts .vscode/launch.json .vscode/tasks.json .vscode/settings.example.json README.md
git commit -m "$(cat <<'EOF'
Add Extension Development Host launch and VSIX packaging.

Document how to point the client at a local language server and how to check definition, references, hover, and diagnostics.
EOF
)"
```

## Traceability

| Draft section | Task |
| --- | --- |
| Project scaffold | Task 1, written as files instead of `yo code` |
| Language registration and grammar | Task 1 and Task 2 |
| LSP client and go to definition | Task 3 and Task 4. No definition code in the client |
| F5 and `vsce package` | Task 5 |

Out of scope: downloading GitHub release binaries, bundling the server, completion, formatting, semantic tokens, and `vsce publish`.

## Self-review

- Spec coverage: scaffold, `.st` language id, grammar, stdio client, F5, and VSIX are each tied to a task. Go to definition is a server feature verified in the Task 5 manual check.
- Placeholder scan: every code step contains the file body and the command to run.
- Type consistency: `resolveServerCommand`, `ServerLaunchConfig`, `ServerCommand`, `tonel-smalltalk`, `tonelSmalltalkLanguageServer`, `tonelSmalltalk.serverProjectPath`, and `tonelSmalltalk.serverPath` use the same names in Tasks 1, 3, 4, and 5.
