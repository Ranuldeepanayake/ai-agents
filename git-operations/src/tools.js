import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Keep repository command output bounded before it is returned to the model.
const MAX_OUTPUT_CHARS = 100_000;

// The agent is for user repositories and must never operate directly in Linux
// system locations, even if the process has sufficient permissions.
const PROTECTED_DIRECTORIES = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/root", "/run", "/sbin", "/sys", "/tmp", "/usr", "/var"];
let repositoryDirectory = null;

/** Return true when a path is a protected system directory or descendant. */
function isProtectedDirectory(target) {
  const resolved = path.resolve(target);
  return PROTECTED_DIRECTORIES.some((item) => resolved === item || resolved.startsWith(`${item}${path.sep}`));
}

/** Require a repository before any Git tool can execute. */
function requireRepository() {
  if (!repositoryDirectory) throw new Error("Set a Git repository root first.");
  return repositoryDirectory;
}

/** Keep a relative Git path inside the selected repository. */
function validateRelativePath(filePath) {
  if (typeof filePath !== "string" || filePath.length === 0 || path.isAbsolute(filePath)) throw new Error("Git paths must be non-empty relative paths.");
  const resolved = path.resolve(repositoryDirectory, filePath);
  const relative = path.relative(repositoryDirectory, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Git path escapes the selected repository.");
  return filePath;
}

/**
 * Execute Git without a shell and preserve both output streams.
 *
 * Arguments are constructed by trusted tool functions, not concatenated into
 * a shell command. Non-zero exits are returned as data for model inspection.
 */
async function runGit(args) {
  const cwd = requireRepository();
  return await new Promise((resolve, reject) => {
    const child = spawn("git", ["--no-pager", ...args], { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => resolve({ command: ["git", ...args].join(" "), exitCode, signal, passed: exitCode === 0, stdout: stdout.slice(0, MAX_OUTPUT_CHARS), stderr: stderr.slice(0, MAX_OUTPUT_CHARS) }));
  });
}

/** Select an existing Git repository root using an absolute path. */
export async function setRepository({ directory }) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) throw new Error("directory must be an absolute path.");
  const resolved = await fs.realpath(directory);
  if (isProtectedDirectory(resolved)) throw new Error("This system directory is protected.");
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error("The repository path must be a directory.");
  const result = await new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", resolved, "rev-parse", "--show-toplevel"], { shell: false, windowsHide: true });
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject); child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
  if (result.exitCode !== 0) throw new Error(`Not a Git repository: ${result.stderr.trim() || "git rev-parse failed"}`);
  const root = await fs.realpath(result.stdout.trim());
  if (root !== resolved) throw new Error("Select the repository root itself, not a subdirectory.");
  repositoryDirectory = root;
  return { repositoryDirectory };
}

/** Return the selected repository root. */
export function getRepository() { return repositoryDirectory; }

/** Show branch, staged, unstaged, and untracked-file status. */
export async function gitStatus() { return runGit(["status", "--short", "--branch"]); }

/** Show a bounded working-tree or staged diff. */
export async function gitDiff({ staged = false, filePath } = {}) {
  const args = ["diff"];
  if (staged) args.push("--cached");
  if (filePath) args.push("--", validateRelativePath(filePath));
  return runGit(args);
}

/** Show recent commit history in a compact, model-readable format. */
export async function gitLog({ limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 10, 100));
  return runGit(["log", `-${safeLimit}`, "--decorate", "--oneline", "--stat"]);
}

/** List local and remote branches. */
export async function gitBranches() { return runGit(["branch", "--all", "--verbose"]); }

/** Create a new branch without switching away from the current branch. */
export async function createBranch({ branch }) {
  if (typeof branch !== "string" || !/^[A-Za-z0-9._/-]+$/.test(branch) || branch.startsWith("-") || branch.endsWith("/")) throw new Error("Invalid branch name.");
  return runGit(["branch", branch]);
}

/** Switch branches using Git's safety checks for local modifications. */
export async function switchBranch({ branch }) {
  if (typeof branch !== "string" || !branch.trim() || branch.startsWith("-")) throw new Error("A valid branch name is required.");
  return runGit(["switch", branch]);
}

/** Stage explicitly named relative paths. This does not stage the whole tree. */
export async function stageFiles({ paths }) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("paths must contain at least one relative path.");
  return runGit(["add", "--", ...paths.map(validateRelativePath)]);
}

/** Remove paths from the index while preserving their working-tree files. */
export async function unstageFiles({ paths }) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("paths must contain at least one relative path.");
  return runGit(["restore", "--staged", "--", ...paths.map(validateRelativePath)]);
}

/** Create a commit with an explicit non-empty message. */
export async function commitChanges({ message }) {
  if (typeof message !== "string" || !message.trim()) throw new Error("A non-empty commit message is required.");
  return runGit(["commit", "-m", message.trim()]);
}

/** Fetch remote references without changing the working tree. */
export async function fetchChanges({ remote = "origin" } = {}) {
  if (typeof remote !== "string" || !/^[A-Za-z0-9._-]+$/.test(remote)) throw new Error("Invalid remote name.");
  return runGit(["fetch", "--prune", remote]);
}

/** Pull only when Git can perform a fast-forward, avoiding implicit merges. */
export async function pullFastForward({ remote = "origin", branch } = {}) {
  if (typeof remote !== "string" || !/^[A-Za-z0-9._-]+$/.test(remote)) throw new Error("Invalid remote name.");
  if (branch !== undefined && (typeof branch !== "string" || !/^[A-Za-z0-9._/-]+$/.test(branch))) throw new Error("Invalid branch name.");
  return runGit(branch ? ["pull", "--ff-only", remote, branch] : ["pull", "--ff-only"]);
}

/** Push a named branch without force flags. */
export async function pushChanges({ remote = "origin", branch } = {}) {
  if (typeof remote !== "string" || !/^[A-Za-z0-9._-]+$/.test(remote)) throw new Error("Invalid remote name.");
  if (typeof branch !== "string" || !/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("A valid branch name is required for push.");
  return runGit(["push", remote, branch]);
}

// Only functions listed here can be selected by Ollama tool calls.
export const toolFunctions = { set_repository: setRepository, git_status: gitStatus, git_diff: gitDiff, git_log: gitLog, git_branches: gitBranches, create_branch: createBranch, switch_branch: switchBranch, stage_files: stageFiles, unstage_files: unstageFiles, commit_changes: commitChanges, fetch_changes: fetchChanges, pull_fast_forward: pullFastForward, push_changes: pushChanges };

/** Build a JSON-schema string property for a tool definition. */
const string = (description) => ({ type: "string", description });

// These schemas describe the safe Git interface exposed to the model.
export const tools = [
  { type: "function", function: { name: "set_repository", description: "Select an absolute Git repository root. This must be the repository root itself.", parameters: { type: "object", properties: { directory: string("Absolute repository root path.") }, required: ["directory"] } } },
  { type: "function", function: { name: "git_status", description: "Show current branch and working-tree status.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "git_diff", description: "Show unstaged or staged changes.", parameters: { type: "object", properties: { staged: { type: "boolean", description: "Show the staged diff when true." }, filePath: string("Optional relative path filter.") }, required: [] } } },
  { type: "function", function: { name: "git_log", description: "Show recent commits and changed-file statistics.", parameters: { type: "object", properties: { limit: { type: "integer", description: "Number of commits, capped at 100." } }, required: [] } } },
  { type: "function", function: { name: "git_branches", description: "List local and remote branches.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "create_branch", description: "Create a new local branch without switching to it.", parameters: { type: "object", properties: { branch: string("New branch name.") }, required: ["branch"] } } },
  { type: "function", function: { name: "switch_branch", description: "Switch to an existing branch using Git safety checks.", parameters: { type: "object", properties: { branch: string("Existing branch name.") }, required: ["branch"] } } },
  { type: "function", function: { name: "stage_files", description: "Stage explicitly named files or directories.", parameters: { type: "object", properties: { paths: { type: "array", items: { type: "string" }, description: "Relative paths to stage." } }, required: ["paths"] } } },
  { type: "function", function: { name: "unstage_files", description: "Remove explicitly named paths from the index without changing working files.", parameters: { type: "object", properties: { paths: { type: "array", items: { type: "string" }, description: "Relative paths to unstage." } }, required: ["paths"] } } },
  { type: "function", function: { name: "commit_changes", description: "Create a commit using the currently staged changes.", parameters: { type: "object", properties: { message: string("Non-empty commit message.") }, required: ["message"] } } },
  { type: "function", function: { name: "fetch_changes", description: "Fetch and prune references from a named remote.", parameters: { type: "object", properties: { remote: string("Remote name, default origin.") }, required: [] } } },
  { type: "function", function: { name: "pull_fast_forward", description: "Pull from a remote using --ff-only; never creates an implicit merge commit.", parameters: { type: "object", properties: { remote: string("Remote name, default origin."), branch: string("Optional branch name.") }, required: [] } } },
  { type: "function", function: { name: "push_changes", description: "Push a named branch without force flags.", parameters: { type: "object", properties: { remote: string("Remote name, default origin."), branch: string("Branch to push.") }, required: ["branch"] } } },
];
