import fs from "node:fs/promises";
import path from "node:path";

// Keep file reads and writes bounded so a model cannot accidentally move a
// large amount of data through the chat context or memory.
const MAX_FILE_BYTES = 1_000_000;

// These locations are intentionally denied even when the process has enough
// operating-system permissions to access them. The agent is for user-owned
// project data, not Linux system administration.
const PROTECTED = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/root", "/run", "/sbin", "/sys", "/tmp", "/usr", "/var"];

// This is the only mutable state shared by the file-operation tools. Every
// other path is resolved relative to this directory.
let workingDirectory = process.cwd();

// Return true when target is the base directory itself or one of its children.
const isInside = (base, target) => {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};

// Check both the protected directory itself and all descendants.
function isProtectedDirectory(target) {
  const normalized = path.resolve(target);
  return PROTECTED.some((item) => normalized === item || normalized.startsWith(`${item}${path.sep}`));
}

// Resolve an existing path through symlinks. For a new path, resolve its
// nearest existing parent so a symlink cannot be used to escape the sandbox.
async function safeRealPath(target, allowMissing = false) {
  try {
    return await fs.realpath(target);
  } catch (error) {
    if (!allowMissing || error.code !== "ENOENT") throw error;
    return safeRealPath(path.dirname(target));
  }
}

// Convert a user-supplied relative path into a path confined to the current
// working directory, including protection against traversal and symlink escape.
async function confinedPath(input, { allowMissing = false } = {}) {
  if (isProtectedDirectory(workingDirectory)) throw new Error("The current working directory is protected; set a user-owned directory first.");
  if (typeof input !== "string" || input.length === 0) throw new Error("A non-empty relative path is required.");
  if (path.isAbsolute(input)) throw new Error("Only relative paths are allowed after the working directory is set.");
  const target = path.resolve(workingDirectory, input);
  const realTarget = await safeRealPath(target, allowMissing);
  if (!isInside(workingDirectory, realTarget)) throw new Error("Access outside the working directory is forbidden.");
  return target;
}

/** Return the currently selected working directory. */
export function getWorkingDirectory() { return workingDirectory; }

/** Change the working directory after validating it is an allowed directory. */
export async function setWorkingDirectory({ directory }) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) throw new Error("directory must be an absolute Linux path.");
  const resolved = await fs.realpath(directory);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) throw new Error("The working directory must be a directory.");
  if (isProtectedDirectory(resolved)) throw new Error("This Linux system directory is protected.");
  workingDirectory = resolved;
  return { workingDirectory };
}

/** List entries in a directory relative to the selected working directory. */
export async function listDirectory({ directory = "." } = {}) {
  const target = await confinedPath(directory);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return { directory: path.relative(workingDirectory, target) || ".", entries: entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other" })) };
}

/** Read a bounded UTF-8 text file. */
export async function readFile({ filePath }) {
  const target = await confinedPath(filePath);
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error("Only regular files can be read.");
  if (stat.size > MAX_FILE_BYTES) throw new Error(`File exceeds the ${MAX_FILE_BYTES}-byte read limit.`);
  return { filePath, content: await fs.readFile(target, "utf8") };
}

/** Create a new file without overwriting an existing file. */
export async function createFile({ filePath, content = "" }) {
  if (typeof content !== "string" || Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error("Content is missing or exceeds the file-size limit.");
  const target = await confinedPath(filePath, { allowMissing: true });
  await fs.mkdir(path.dirname(target), { recursive: false });
  await fs.writeFile(target, content, { flag: "wx" });
  return { filePath, bytes: Buffer.byteLength(content) };
}

/** Create one new directory. Parent directories must already exist. */
export async function createDirectory({ directory }) {
  const target = await confinedPath(directory, { allowMissing: true });
  await fs.mkdir(target, { recursive: false });
  return { directory };
}

/** Rename a file or directory without allowing the destination to escape. */
export async function renamePath({ from, to }) {
  const source = await confinedPath(from);
  const destination = await confinedPath(to, { allowMissing: true });
  if (path.resolve(source) === path.resolve(destination)) throw new Error("Source and destination are the same.");
  await fs.rename(source, destination);
  return { from, to };
}

/** Delete a file, or explicitly recursively delete a directory. */
export async function deletePath({ target, recursive = false } = {}) {
  const resolved = await confinedPath(target);
  if (path.resolve(resolved) === path.resolve(workingDirectory)) throw new Error("Deleting the working directory is forbidden.");
  const stat = await fs.lstat(resolved);
  if (stat.isDirectory() && recursive !== true) throw new Error("Directory deletion requires recursive=true.");
  await fs.rm(resolved, { recursive: Boolean(recursive), force: false });
  return { target, deleted: true };
}

// The dispatcher maps model-selected tool names to trusted JavaScript
// implementations. The model never receives direct filesystem access.
export const toolFunctions = { set_working_directory: setWorkingDirectory, list_directory: listDirectory, read_file: readFile, create_file: createFile, create_directory: createDirectory, rename_path: renamePath, delete_path: deletePath };

// JSON schemas tell Ollama which arguments each tool accepts.
const string = (description) => ({ type: "string", description });
export const tools = [
  { type: "function", function: { name: "set_working_directory", description: "Set the agent working directory. This is the only tool accepting an absolute path.", parameters: { type: "object", properties: { directory: string("Absolute Linux directory path.") }, required: ["directory"] } } },
  { type: "function", function: { name: "list_directory", description: "List files and directories within the current working directory.", parameters: { type: "object", properties: { directory: string("Relative directory path, default '.'.") }, required: [] } } },
  { type: "function", function: { name: "read_file", description: "Read a UTF-8 text file within the current working directory.", parameters: { type: "object", properties: { filePath: string("Relative file path.") }, required: ["filePath"] } } },
  { type: "function", function: { name: "create_file", description: "Create a new UTF-8 file; never overwrites an existing file.", parameters: { type: "object", properties: { filePath: string("Relative file path."), content: string("File contents.") }, required: ["filePath", "content"] } } },
  { type: "function", function: { name: "create_directory", description: "Create one new directory within the current working directory.", parameters: { type: "object", properties: { directory: string("Relative directory path.") }, required: ["directory"] } } },
  { type: "function", function: { name: "rename_path", description: "Rename or move a file/directory within the current working directory.", parameters: { type: "object", properties: { from: string("Existing relative path."), to: string("New relative path.") }, required: ["from", "to"] } } },
  { type: "function", function: { name: "delete_path", description: "Delete a file or directory within the current working directory.", parameters: { type: "object", properties: { target: string("Relative path."), recursive: { type: "boolean", description: "Required true for non-empty directories." } }, required: ["target"] } } },
];
