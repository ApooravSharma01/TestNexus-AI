import { spawn } from "node:child_process";

import { projectRoot } from "../utils/project-root.js";

// npm run dev:all
// Starts the suite runner API and the dashboard together, with labelled output.
// Ctrl+C stops both.
const LABELS = {
  api: "\u001b[36m[api]\u001b[0m",
  dashboard: "\u001b[35m[dashboard]\u001b[0m"
};

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    shell: process.platform === "win32"
  });

  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");

    let pending = "";

    stream.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop();

      for (const line of lines) {
        process.stdout.write(`${LABELS[name]} ${line}\n`);
      }
    });
  }

  child.on("exit", (code) => {
    process.stdout.write(`${LABELS[name]} stopped (exit code ${code})\n`);
  });

  return child;
}

const children = [
  start("api", process.execPath, ["src/commands/suite-server.js"]),
  start("dashboard", "npm", ["--prefix", "dashboard", "run", "dev", "--", "--host", "127.0.0.1"])
];

function stopAll() {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

process.stdout.write("Dashboard: http://127.0.0.1:5173   (Ctrl+C stops both)\n");
