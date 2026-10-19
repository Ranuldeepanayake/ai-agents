# Unit tester agent

Node.js agent for Ollama's `qwen2.5-coder:7b`. A controller creates Node.js tests for source files in a context directory, runs the tests, captures stdout and stderr separately, sends failures or warnings to the model for repair, and repeats the run in a bounded loop.

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

Ask the agent to set a context directory using an absolute path. The context is confined to that directory, and generated tests are placed under `tests/`. The test command defaults to Node's built-in test runner: `node --test tests`.

The controller records the files covered, command, every iteration's exit code/stdout/stderr, editing summary, and final result in `TESTING.md` in the context directory. Test and source edits are limited to the context directory and are never performed outside it. Set `MAX_TEST_ITERATIONS` to change the default five repair iterations.

Tool invocations, test iterations, and errors are printed to stderr with ISO timestamps and the `unit-tester` agent name. Test output is also recorded in `TESTING.md`.
