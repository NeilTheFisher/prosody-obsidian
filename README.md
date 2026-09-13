# Prosody

Local transcription, word-synced playback, and AI summaries through any ACP
agent — inside Obsidian.

Record a voice note, get a transcript that highlights word-by-word as it plays,
and summarize it with whichever agent you already use (OpenCode, Claude Code,
Codex, Gemini CLI, Kiro, Hermes, Mistral Vibe) over the
[Agent Client Protocol](https://agentclientprotocol.com). No API keys, no cloud
transcription.

## Features

- **Word-level follow-along** — the transcript highlights the word being spoken;
  click any word to seek. Runs inline in the note, not a separate view.
- **Local ASR, no keys** — transcription via a self-hosted OpenAI-compatible
  endpoint (e.g. an Orukeet / sherpa-onnx server). Audio never leaves your
  machine.
- **Agent-agnostic summaries** — the ✨ button sends the transcript to any ACP
  agent and inserts a collapsible summary callout. Model is picked per agent.
- **Mobile** — connect to a remote ACP-over-WebSocket bridge and summarize from
  Obsidian on iOS/Android too.

## How it works

````
Audio recorder ─► <name>.m4a + <name>.json (words + timings)
                        │
                        ▼
        ```prosody  <audio>.m4a  ```   ← renders player + karaoke transcript
                        │  ✨
                        ▼
        ACP agent (stdio on desktop, wss:// on mobile) ─► summary callout
````

The sidecar `<name>.json` is produced by your transcription service. If you use
the reference watcher, a new recording is transcribed automatically, the sidecar
is written, and the `![[audio]]` embed is swapped for a `prosody` block.

## Install

Copy `main.js`, `manifest.json`, and `styles.css` into
`.obsidian/plugins/prosody-obsidian/` and enable **Prosody**.

## Configure

**Settings → Prosody**

- **Agents** — enable presets or add a custom one. A command (e.g. `opencode acp`)
  runs over stdio on desktop; a `wss://` URL connects to a remote bridge (works on
  mobile).
- **Default agent**, **Permissions** (auto-deny by default), **Prompt**,
  **Working directory**, **WSL** options, **Debug logging**.

The cog on each transcript opens a quick popup: agent, model (loaded live from
the agent's ACP config options), and permissions.

## Transcription sidecar format

`<audio>.json`:

```json
{
  "text": "full transcript",
  "segments": [{ "start": 0.07, "end": 5.57, "text": "...", "words": [] }],
  "words": [{ "w": "On", "s": 0.07, "e": 0.2 }]
}
```

## Remote bridge

A WebSocket ↔ stdio bridge (`acp-bridge/`) lets mobile clients reach a local
agent. Endpoint: `wss://host/acp/<agentId>?token=...` (root path defaults to
opencode for backwards compatibility). See `acp-bridge/README.md`.

## License

MIT
