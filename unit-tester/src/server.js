import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.js";

// Keep the terminal interface thin; the deterministic workflow lives in
// runAgent so it can be reused programmatically.
const log = (level, message) => console.error(`[${new Date().toISOString()}] [unit-tester] [${level}] ${message}`);
const rl = readline.createInterface({ input: stdin, output: stdout });
log("INFO", "Unit tester agent (Ollama qwen2.5-coder:7b)");
log("INFO", "Ask it to set an absolute context directory, then create and run tests. Type 'exit' to quit.");
try {
  // Accept requests until the user enters the exit sentinel.
  while (true) {
    const task = (await rl.question("You: ")).trim();
    if (task.toLowerCase() === "exit") break;
    if (!task) continue;
    try { log("AGENT", await runAgent(task)); }
    catch (error) { log("ERROR", `Agent error: ${error instanceof Error ? error.message : String(error)}`); }
  }
} finally {
  // Always release stdin even when the agent or terminal raises an exception.
  rl.close();
}
