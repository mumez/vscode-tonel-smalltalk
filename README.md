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

`npm run package` uses `@vscode/vsce` 4, which requires Node.js 22 or newer.

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
3. `<extension>/node_modules/.bin/tonel-smalltalk-language-server` when that file exists
4. `tonel-smalltalk-language-server` on `PATH`

A normal `npm install` does not create step 3. The language server is a Rust binary, not an npm package of this extension.

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

`npm run compile` type-checks with `tsc` and bundles `src/extension.ts` and `vscode-languageclient` into `dist/extension.js` with esbuild, so the VSIX ships no `node_modules`. This produces `vscode-tonel-smalltalk-0.0.1.vsix`. Install it from the VS Code Extensions view with **Install from VSIX**.

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

## Known limitations

- The language server is not bundled. If no binary can be started, activation fails with VS Code's generic extension error. The first `cargo run --release` compiles the server and can take several minutes, with no extra progress message from this extension.
- `tonelSmalltalk.serverPath` and `tonelSmalltalk.serverProjectPath` are read when the extension activates. Changing them needs a window reload. There is no restart command.
- The server indexes the workspace folder at startup, then updates documents that are open. It does not handle `workspace/didChangeWatchedFiles`, so a class added or edited in a closed `.st` file stays out of the index until reload.
- Highlighting is a TextMate grammar, not the tree-sitter grammar used by the language server. These forms are colored incorrectly or not at all:
  - radix integers such as `16r1F`
  - a leading minus on a number, such as `-3`
  - scaled decimals such as `1.5s2` (the `.` is treated as a statement terminator)
  - keyword symbols such as `#at:put:`
  - a space character literal, `$` followed by a space
  - `Class`, `Trait`, `Extension`, and `Package` anywhere, including when they are message receivers
- A `<...>` pragma is recognized only at the start of a line, after optional whitespace. A comparison written that way is colored as a pragma.
- The server provides definition, references, hover, and syntax diagnostics. Completion, formatting, rename, and code actions are not available.

## Remaining work

- `@types/vscode` is declared as `^1.85.0`, so the lockfile can resolve a much newer API than the VS Code 1.85 engine. Pin a 1.85-compatible range before using newer editor APIs.
- Publishing is not set up.
- `npm test` does not launch the Extension Development Host. The manual check above is still the way to confirm definition, references, hover, and diagnostics against a real language server.
