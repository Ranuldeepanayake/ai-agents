import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.js";

// Keep the CLI thin so runAgent can also be imported by another Node program.
const log = (level, message) => console.error(`[${new Date().toISOString()}] [git-operations] [${level}] ${message}`);
const rl = readline.createInterface({ input: stdin, output: stdout });
log("INFO", "Git operations agent (Ollama qwen2.5-coder:7b)");
log("INFO", "Set a repository root, then request Git operations. Type 'exit' to quit.");

try {
  // Process requests until the user exits, while keeping errors timestamped.
  while (true) {
    const task = (await rl.question("You: ")).trim();
    if (task.toLowerCase() === "exit") break;
    if (!task) continue;
    try { log("AGENT", await runAgent(task)); }
    catch (error) { log("ERROR", `Agent error: ${error instanceof Error ? error.message : String(error)}`); }
  }
} finally {
  // Always release stdin on exit or failure.
  rl.close();
}
