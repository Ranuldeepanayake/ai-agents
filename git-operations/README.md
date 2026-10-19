# Git operations agent

Node.js agent for Ollama's `qwen2.5-coder:7b`. It performs common Git operations inside one explicitly selected repository and returns complete stdout, stderr, exit code, and status information to the model.

## Run

```sh
npm install
OLLAMA_BASE_URL=http://192.168.56.1:11434/v1 \
OLLAMA_MODEL=qwen2.5-coder:7b \
npm start
```

For a remote Ollama server, replace `OLLAMA_BASE_URL` with its OpenAI-compatible API base URL, normally ending in `/v1`. `OLLAMA_MODEL` defaults to `qwen2.5-coder:7b` when omitted.

Ask the agent to set an absolute Git repository root before requesting operations:

```text
Set the repository to /home/me/project, show the status, and summarize the current changes.
```

Supported operations include status, diff, log, branch listing, branch creation/switching, staging, unstaging, commits, fast-forward-only pulls, fetches, and pushes. Destructive reset, clean, branch deletion, and force-push operations are intentionally not exposed. The model must not claim an operation succeeded unless the Git tool result confirms it.

All tool calls and errors are printed to stderr with ISO timestamps and the `git-operations` agent name. Tool results include stdout and stderr so Git diagnostics remain visible to the model.
