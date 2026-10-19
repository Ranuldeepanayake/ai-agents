import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.js";

// The CLI provides one continuous conversation over every specialist tool.
const log = (level, message) => console.error(`[${new Date().toISOString()}] [orchestrator] [${level}] ${message}`);
const rl = readline.createInterface({ input: stdin, output: stdout });
log("INFO", "Unified orchestrator (Ollama qwen2.5-coder:7b)");
log("INFO", "Use one conversation for file, test, web, and Git tasks. Type 'exit' to quit.");

try {
  while (true) {
    const task = (await rl.question("You: ")).trim();
    if (task.toLowerCase() === "exit") break;
    if (!task) continue;
    try { log("AGENT", await runAgent(task)); }
    catch (error) { log("ERROR", `Agent error: ${error instanceof Error ? error.message : String(error)}`); }
  }
} finally {
  rl.close();
}
