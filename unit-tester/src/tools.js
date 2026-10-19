import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Bound model-readable file content to keep prompts and memory manageable.
const MAX_FILE_BYTES = 1_000_000;

// The unit tester has one mutable context root. All source, test, and report
// paths must remain beneath this directory.
let contextDirectory = null;

// Refuse tool use until the model has explicitly selected a context directory.
function ensureContext() { if (!contextDirectory) throw new Error("Set a context directory first."); }

// Check whether a resolved path remains inside the selected context root.
function inside(target) { const rel = path.relative(contextDirectory, target); return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel)); }

// Resolve an existing path through symlinks, or validate the nearest existing
// parent when the caller is creating a new file or directory.
async function safePath(relativePath, allowMissing = false) {
  ensureContext();
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) throw new Error("Only relative paths inside the context are allowed.");
  const target = path.resolve(contextDirectory, relativePath);
  try {
    const real = await fs.realpath(target);
    if (!inside(real)) throw new Error("Path escapes the context directory.");
  } catch (error) {
    if (!allowMissing || error.code !== "ENOENT") throw error;
    const parent = await fs.realpath(path.dirname(target));
    if (!inside(parent)) throw new Error("Path escapes the context directory.");
  }
  return target;
}

/** Set the absolute directory containing the source project under test. */
export async function setContextDirectory({ directory }) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) throw new Error("directory must be an absolute path.");
  const resolved = await fs.realpath(directory);
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error("Context must be a directory.");
  contextDirectory = resolved;
  return { contextDirectory };
}

/** Return the current source/test context root. */
export function getContextDirectory() { return contextDirectory; }

/** Recursively discover JavaScript source files while skipping dependencies. */
export async function listSourceFiles({ directory = "." } = {}) {
  const target = await safePath(directory);
  const result = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") await walk(full);
      else if (entry.isFile() && /\.(js|mjs|cjs)$/.test(entry.name)) result.push(path.relative(contextDirectory, full));
    }
  }
  await walk(target); return result;
}

/** Read one bounded UTF-8 source or test file. */
export async function readFile({ filePath }) { const target = await safePath(filePath); const stat = await fs.stat(target); if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("File is not a readable regular file within the size limit."); return { filePath, content: await fs.readFile(target, "utf8") }; }

/** Create or replace a file within the context directory. */
export async function writeFile({ filePath, content }) { if (typeof content !== "string" || Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error("Content exceeds the file-size limit."); const target = await safePath(filePath, true); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); return { filePath, bytes: Buffer.byteLength(content) }; }

/**
 * Run the Node test command with separate stdout and stderr listeners.
 *
 * shell:false prevents model-provided command strings from being interpreted
 * as a shell script. The returned object is deliberately complete so the
 * model can inspect failures and warnings accurately.
 */
export async function runTests({ command = "node", args = ["--test", "tests"] } = {}) {
  ensureContext();
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new Error("args must be an array of strings.");
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: contextDirectory, shell: false, windowsHide: true });
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ command: [command, ...args].join(" "), exitCode: code, signal, passed: code === 0, stdout, stderr }));
  });
}

/** Write the controller-generated report in the context root. */
export async function writeTestingReport({ content }) { return writeFile({ filePath: "TESTING.md", content }); }

// Only these functions can be selected by Ollama tool calls.
export const toolFunctions = { set_context_directory: setContextDirectory, list_source_files: listSourceFiles, read_file: readFile, write_file: writeFile, run_tests: runTests, write_testing_report: writeTestingReport };

// Tool schemas describe the safe interface available to the model.
const string = (description) => ({ type: "string", description });
export const tools = [
  { type: "function", function: { name: "set_context_directory", description: "Set the absolute directory containing Node.js source files to test.", parameters: { type: "object", properties: { directory: string("Absolute context directory path.") }, required: ["directory"] } } },
  { type: "function", function: { name: "list_source_files", description: "List JavaScript source files in the context.", parameters: { type: "object", properties: { directory: string("Relative directory, default '.'.") }, required: [] } } },
  { type: "function", function: { name: "read_file", description: "Read a source or test file from the context.", parameters: { type: "object", properties: { filePath: string("Relative path.") }, required: ["filePath"] } } },
  { type: "function", function: { name: "write_file", description: "Create or update a test/source file in the context.", parameters: { type: "object", properties: { filePath: string("Relative path."), content: string("Complete file contents.") }, required: ["filePath", "content"] } } },
  { type: "function", function: { name: "run_tests", description: "Run Node tests and return exit code plus complete stdout and stderr.", parameters: { type: "object", properties: { command: string("Executable, normally node."), args: { type: "array", items: { type: "string" }, description: "Arguments, normally ['--test','tests']." } }, required: [] } } },
  { type: "function", function: { name: "write_testing_report", description: "Write the required test details to TESTING.md in the context.", parameters: { type: "object", properties: { content: string("Markdown report content.") }, required: ["content"] } } },
];
