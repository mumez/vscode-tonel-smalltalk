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
