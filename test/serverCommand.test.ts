import assert from "node:assert/strict";
import test from "node:test";
import { resolveServerCommand } from "../src/serverCommand";

test("serverPath wins over PATH", () => {
  const command = resolveServerCommand({
    serverPath: "  /opt/tonel-smalltalk-language-server  "
  });

  assert.deepEqual(command, {
    command: "/opt/tonel-smalltalk-language-server",
    args: []
  });
});

test("PATH is the fallback", () => {
  const command = resolveServerCommand({ serverPath: "" });

  assert.deepEqual(command, {
    command: "tonel-smalltalk-language-server",
    args: []
  });
});
