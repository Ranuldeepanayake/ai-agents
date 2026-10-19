import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.js";

// Keep the interactive CLI thin so runAgent can also be imported by another
// Node.js program or embedded in a larger workflow.
const log = (level, message) => console.error(`[${new Date().toISOString()}] [web-coding] [${level}] ${message}`);
const rl = readline.createInterface({ input: stdin, output: stdout });
log("INFO", "Web coding agent (Ollama qwen2.5-coder:7b)");
log("INFO", "Provide a coding task and optional public HTML/PDF URLs. Type 'exit' to quit.");

try {
  // Process one user request at a time and preserve readable error messages.
  while (true) {
    const task = (await rl.question("You: ")).trim();
    if (task.toLowerCase() === "exit") break;
    if (!task) continue;
    try { log("AGENT", await runAgent(task)); }
    catch (error) { log("ERROR", `Agent error: ${error instanceof Error ? error.message : String(error)}`); }
  }
} finally {
  // Release the terminal input even if Ollama or a tool fails.
  rl.close();
}
