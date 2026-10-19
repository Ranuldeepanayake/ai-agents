#!/usr/bin/env bash

# Launch one agent directly, or all three in separate tmux windows.
# This script targets Linux, matching the filesystem safety model of the agents.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434/v1}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5-coder:7b}"
export OLLAMA_BASE_URL OLLAMA_MODEL

usage() {
  cat <<'EOF'
Usage:
  ./run-agents.sh file-operations
  ./run-agents.sh unit-tester
  ./run-agents.sh web-coding
  ./run-agents.sh all [tmux-session-name]

Environment:
  OLLAMA_BASE_URL  Ollama OpenAI-compatible API base URL.
                    Default: http://localhost:11434/v1
  OLLAMA_MODEL      Ollama model name.
                    Default: qwen2.5-coder:7b
EOF
}

start_agent() {
  local agent="$1"
  if [[ ! -d "$ROOT_DIR/$agent" ]]; then
    echo "Unknown agent directory: $agent" >&2
    exit 1
  fi
  cd "$ROOT_DIR/$agent"
  exec npm start
}

start_all() {
  local session_name="${1:-local-ai-agents}"
  command -v tmux >/dev/null 2>&1 || {
    echo "The 'all' mode requires tmux so each interactive agent can have its own terminal." >&2
    echo "Install tmux, then rerun: ./run-agents.sh all" >&2
    exit 1
  }

  if tmux has-session -t "$session_name" 2>/dev/null; then
    echo "tmux session already exists: $session_name" >&2
    echo "Attach with: tmux attach -t $session_name" >&2
    exit 1
  fi

  local env_prefix="OLLAMA_BASE_URL=$(printf '%q' "$OLLAMA_BASE_URL") OLLAMA_MODEL=$(printf '%q' "$OLLAMA_MODEL")"
  tmux new-session -d -s "$session_name" -n file-operations \
    "cd $(printf '%q' "$ROOT_DIR/file-operations") && $env_prefix npm start"
  tmux new-window -t "$session_name" -n unit-tester \
    "cd $(printf '%q' "$ROOT_DIR/unit-tester") && $env_prefix npm start"
  tmux new-window -t "$session_name" -n web-coding \
    "cd $(printf '%q' "$ROOT_DIR/web-coding") && $env_prefix npm start"
  tmux select-window -t "$session_name:file-operations"
  echo "Started all agents in tmux session: $session_name"
  echo "Attach with: tmux attach -t $session_name"
}

case "${1:-}" in
  file-operations|unit-tester|web-coding) start_agent "$1" ;;
  all) start_all "${2:-local-ai-agents}" ;;
  -h|--help) usage ;;
  *) usage; exit 1 ;;
esac
