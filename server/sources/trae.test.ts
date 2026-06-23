import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

function writeRollout(
  root: string,
  lines: Array<Record<string, unknown>>
): string {
  const dir = path.join(root, ".trae", "cli", "sessions", "2026", "06", "23");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(
    dir,
    "rollout-2026-06-23T16-12-05-test-session.jsonl"
  );
  fs.writeFileSync(
    filePath,
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf-8"
  );
  return filePath;
}

function writeSessionIndex(
  root: string,
  rows: Array<Record<string, unknown>>
): void {
  const dir = path.join(root, ".trae", "cli");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "session_index.jsonl"),
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf-8"
  );
}

test("indexes TraeX sessions whose session_meta line is larger than 8KB", async () => {
  const originalHome = process.env.HOME;
  const originalTraeHome = process.env.TRAE_HOME;
  const originalTraeCliHome = process.env.TRAE_CLI_HOME;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "cc-reader-trae-"));

  try {
    process.env.HOME = tempHome;
    delete process.env.TRAE_HOME;
    delete process.env.TRAE_CLI_HOME;

    writeRollout(tempHome, [
      {
        timestamp: "2026-06-23T08:14:42.446Z",
        type: "session_meta",
        payload: {
          id: "test-session",
          timestamp: "2026-06-23T08:12:05.174Z",
          cwd: "/tmp/cc-reader-traex",
          base_instructions: { text: "x".repeat(20_000) },
        },
      },
      {
        timestamp: "2026-06-23T08:15:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "load this TraeX session" }],
        },
      },
    ]);

    const mod = await import(`./trae.ts?case=${Date.now()}`);
    const projects = mod.traeSource.listProjects();

    assert.deepEqual(projects, [
      {
        name: "tmp/cc-reader-traex",
        dirName: "-tmp-cc-reader-traex",
        path: "/tmp/cc-reader-traex",
        sessionCount: 1,
      },
    ]);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalTraeHome === undefined) delete process.env.TRAE_HOME;
    else process.env.TRAE_HOME = originalTraeHome;
    if (originalTraeCliHome === undefined) delete process.env.TRAE_CLI_HOME;
    else process.env.TRAE_CLI_HOME = originalTraeCliHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("uses TraeX session_index thread_name as the session title", async () => {
  const originalHome = process.env.HOME;
  const originalTraeHome = process.env.TRAE_HOME;
  const originalTraeCliHome = process.env.TRAE_CLI_HOME;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "cc-reader-trae-"));

  try {
    process.env.HOME = tempHome;
    delete process.env.TRAE_HOME;
    delete process.env.TRAE_CLI_HOME;

    writeRollout(tempHome, [
      {
        timestamp: "2026-06-23T08:14:42.446Z",
        type: "session_meta",
        payload: {
          id: "renamed-session",
          timestamp: "2026-06-23T08:12:05.174Z",
          cwd: "/tmp/cc-reader-traex",
        },
      },
      {
        timestamp: "2026-06-23T08:15:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "old first message" }],
        },
      },
    ]);
    writeSessionIndex(tempHome, [
      {
        id: "renamed-session",
        thread_name: "支持 nexus_network_policy_assembler 的 TenantEntity 映射",
        updated_at: "2026-06-23T08:44:46.707819Z",
      },
    ]);

    const mod = await import(`./trae.ts?case=${Date.now()}-renamed`);
    const sessions = mod.traeSource.listSessions("-tmp-cc-reader-traex");

    assert.equal(
      sessions[0].firstMessage,
      "支持 nexus_network_policy_assembler 的 TenantEntity 映射"
    );
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalTraeHome === undefined) delete process.env.TRAE_HOME;
    else process.env.TRAE_HOME = originalTraeHome;
    if (originalTraeCliHome === undefined) delete process.env.TRAE_CLI_HOME;
    else process.env.TRAE_CLI_HOME = originalTraeCliHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test("does not list TraeX sessions that only contain session_meta", async () => {
  const originalHome = process.env.HOME;
  const originalTraeHome = process.env.TRAE_HOME;
  const originalTraeCliHome = process.env.TRAE_CLI_HOME;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "cc-reader-trae-"));

  try {
    process.env.HOME = tempHome;
    delete process.env.TRAE_HOME;
    delete process.env.TRAE_CLI_HOME;

    writeRollout(tempHome, [
      {
        timestamp: "2026-06-23T09:50:12.457Z",
        type: "session_meta",
        payload: {
          id: "empty-session",
          timestamp: "2026-06-23T09:19:57.267Z",
          cwd: "/tmp/cc-reader-traex",
        },
      },
    ]);

    const mod = await import(`./trae.ts?case=${Date.now()}-empty`);

    assert.deepEqual(mod.traeSource.listProjects(), []);
    assert.deepEqual(mod.traeSource.recentSessions(5), []);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalTraeHome === undefined) delete process.env.TRAE_HOME;
    else process.env.TRAE_HOME = originalTraeHome;
    if (originalTraeCliHome === undefined) delete process.env.TRAE_CLI_HOME;
    else process.env.TRAE_CLI_HOME = originalTraeCliHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
