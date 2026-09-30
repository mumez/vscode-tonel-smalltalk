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
    scripts: { package: string; "vscode:prepublish": string };
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
    manifest.contributes.configuration.properties["tonelSmalltalk.serverPath"]
      .default,
    ""
  );
  assert.equal(manifest.scripts["vscode:prepublish"], "npm run compile");
  assert.equal(manifest.scripts.package, "vsce package");
});

test("compile bundles the extension with esbuild", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ) as { scripts: { compile: string } };

  assert.match(manifest.scripts.compile, /tsc -p tsconfig\.json --noEmit/);
  assert.match(manifest.scripts.compile, /esbuild src\/extension\.ts --bundle/);
  assert.match(manifest.scripts.compile, /--external:vscode/);
  assert.match(manifest.scripts.compile, /--outfile=dist\/extension\.js/);
});

test("vscodeignore ships only the bundled extension and no node_modules", () => {
  const ignore = fs.readFileSync(path.join(root, ".vscodeignore"), "utf8");

  assert.match(ignore, /^node_modules\/\*\*$/m);
  assert.doesNotMatch(ignore, /^!node_modules/m);
  assert.match(ignore, /^dist\/\*\*$/m);
  assert.match(ignore, /^!dist\/extension\.js$/m);
  assert.match(ignore, /^AGENTS\.local\.md$/m);
  assert.match(ignore, /^\.claude\/\*\*$/m);
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
