# Unified agent orchestrator

The orchestrator provides one Ollama conversation over the file, unit-testing, web-coding, and Git capabilities. It shares one project directory across all tools, so the model can research documentation, edit code, run tests, and inspect or commit Git changes in one session.

## Setup and run

The root launcher installs dependencies automatically. To set up manually, install dependencies for the orchestrator and the imported specialist tools:

```sh
cd orchestrator && npm install
cd ../file-operations && npm install
cd ../unit-tester && npm install
cd ../web-coding && npm install
cd ../orchestrator
OLLAMA_BASE_URL=http://192.168.56.1:11434/v1 \
OLLAMA_MODEL=qwen2.5-coder:7b \
npm start
```

`OLLAMA_BASE_URL` normally ends with `/v1` and defaults to `http://192.168.56.1:11434/v1`. `OLLAMA_MODEL` defaults to `qwen2.5-coder:7b`.

Start with a request such as:

```text
Set the project directory to /home/me/project, read the API documentation at https://example.com/docs, implement the client, run tests, and show the Git status.
```

Tool names are prefixed by capability (`file_`, `test_`, `web_`, and `git_`). The model receives one shared conversation and one shared project directory. Mutating Git operations still require an explicit user request. Destructive reset, clean, branch deletion, and force-push operations are not exposed.

If you prefer independent sessions, use the root launcher or run an individual agent directly. The orchestrator does not replace those agents.

All logs are written to stderr with ISO timestamps and the `orchestrator` name. If Qwen emits a JSON tool request as normal text instead of a native tool call, the orchestrator parses that format as a compatibility fallback.
