import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.js";

// This small CLI keeps the interactive shell separate from the agent logic so
// the same runAgent function can also be imported by another Node program.
const log = (level, message) => console.error(`[${new Date().toISOString()}] [file-operations] [${level}] ${message}`);
const rl = readline.createInterface({ input: stdin, output: stdout });
log("INFO", "File operations agent (Ollama qwen2.5-coder:7b)");
log("INFO", "Ask it to set an absolute working directory, then request file operations. Type 'exit' to quit.");
try {
  // Continue accepting tasks until the user types the sentinel command.
  while (true) {
    const task = (await rl.question("You: ")).trim();
    if (task.toLowerCase() === "exit") break;
    if (!task) continue;
    try { log("AGENT", await runAgent(task)); }
    catch (error) { log("ERROR", `Agent error: ${error instanceof Error ? error.message : String(error)}`); }
  }
} finally { rl.close(); }
