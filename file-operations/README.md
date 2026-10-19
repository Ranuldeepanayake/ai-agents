# File operations agent

Node.js agent for Ollama's `qwen2.5-coder:7b`. It uses Ollama's OpenAI-compatible `/v1/chat/completions` endpoint with tool calling.

## Run

```sh
npm install
OLLAMA_BASE_URL=http://localhost:11434/v1 \
OLLAMA_MODEL=qwen2.5-coder:7b \
npm start
```

For Ollama running on another host, replace the base URL:

```sh
OLLAMA_BASE_URL=http://192.168.1.50:11434/v1 \
OLLAMA_MODEL=qwen2.5-coder:7b \
npm start
```

`OLLAMA_BASE_URL` should normally end with `/v1`; `OLLAMA_MODEL` defaults to `qwen2.5-coder:7b` when omitted.

The agent starts in the directory where it is launched. Ask it to set an absolute working directory, for example: `Set the working directory to /home/me/project`. The model must use `set_working_directory`; after that, all other paths are relative to the selected directory.

The agent refuses protected Linux system directories, paths outside the current working directory, symlink escapes, deleting the current directory, and oversized file reads/writes.

Tool invocations and errors are printed to stderr with ISO timestamps and the agent name, for example: `[2026-10-19T12:34:56.000Z] [file-operations] [TOOL] list_directory {"directory":"."}`.
