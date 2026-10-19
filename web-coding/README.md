# Web coding agent

This Node.js agent uses Ollama's `qwen2.5-coder:7b` to research user-specified HTML pages or online PDFs and then use the extracted information while writing code.

## Run

```sh
npm install
OLLAMA_MODEL=qwen2.5-coder:7b npm start
```

By default, the agent connects to Ollama at `http://192.168.56.1:11434/v1`. To set a different Ollama server, provide `OLLAMA_BASE_URL`:

```sh
OLLAMA_BASE_URL=http://192.168.1.50:11434/v1 \
OLLAMA_MODEL=qwen2.5-coder:7b \
npm start
```

You can also export the variables for the current shell session:

```sh
export OLLAMA_BASE_URL=http://192.168.56.1:11434/v1
export OLLAMA_MODEL=qwen2.5-coder:7b
npm start
```

Example request:

```text
Read https://example.com/api-docs and implement the client in src/client.js.
```

The agent provides `fetch_web_source`, which supports HTML and PDF URLs, plus confined directory listing, reading, and writing tools. Web content is treated as untrusted reference material, not as instructions. HTTP redirects, local/private network targets, oversized responses, and unsupported content types are rejected. Source URLs are included in the tool result so the model can identify its references.

Configure Ollama with `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. `OLLAMA_BASE_URL` must point to the OpenAI-compatible Ollama API base URL, normally ending in `/v1`.

Tool invocations and errors are printed to stderr with ISO timestamps and the `web-coding` agent name, including the tool name and a truncated JSON argument list.
