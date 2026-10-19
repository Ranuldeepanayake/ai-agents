# Local Ollama agents

This workspace contains four independent Node.js agents plus one unified orchestrator for Ollama's `qwen2.5-coder:7b` model:

- `file-operations`: confined file and directory operations with an explicit absolute-path working-directory change.
- `unit-tester`: Node.js test generation, execution, stdout/stderr capture, iterative repair, and `TESTING.md` reporting.
- `web-coding`: public HTML/PDF research combined with confined project code inspection and editing.
- `git-operations`: confined Git status, history, branch, staging, commit, and safe synchronization operations.
- `orchestrator`: one shared conversation over all four specialist capabilities.

Each agent has its own `package.json`, README, and `src/` directory. Start Ollama first, then run `npm install` and `npm start` from the agent directory. All agents use Ollama's OpenAI-compatible chat-completions endpoint.

The default configuration is:

```sh
OLLAMA_BASE_URL=http://192.168.56.1:11434/v1
OLLAMA_MODEL=qwen2.5-coder:7b
```

For a different Ollama host, set both variables before starting an agent:

```sh
OLLAMA_BASE_URL=http://192.168.1.50:11434/v1 \
OLLAMA_MODEL=qwen2.5-coder:7b \
npm start
```

`OLLAMA_BASE_URL` should normally end with `/v1` because the agents use Ollama's OpenAI-compatible API.

All agents write timestamped diagnostics to stderr, including the agent name. Tool calls appear as lines such as `[2026-10-19T12:34:56.000Z] [file-operations] [TOOL] list_directory {"directory":"."}`; tool failures use the `ERROR` level.

The agents also support a Qwen/Ollama compatibility fallback: if the model returns a JSON object containing `name` and `arguments` as normal message content instead of a native tool call, the agent executes it as a tool request and logs it with the `TOOL` level.

## Launcher

The root `run-agents.sh` script sets the Ollama environment variables, runs `npm install` for the selected agent, and can launch one agent, the unified orchestrator, or all five processes. On Linux, make it executable once with `chmod +x run-agents.sh`. Run one agent directly with `./run-agents.sh web-coding`, use the unified session with `./run-agents.sh orchestrator`, or run all five interactively in separate `tmux` windows with `./run-agents.sh all`. In `all` mode, dependencies for all five packages are installed before the `tmux` session is created.
