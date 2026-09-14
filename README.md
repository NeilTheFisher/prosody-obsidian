# Prosody

Local transcription, word-synced playback, and AI summaries through any ACP
agent — inside Obsidian.

Record a voice note, get a transcript that highlights word-by-word as it plays,
and summarize it with whichever agent you already use (OpenCode, Claude Code,
Codex, Gemini CLI, Kiro, Hermes, Mistral Vibe) over the
[Agent Client Protocol](https://agentclientprotocol.com). No API keys, no cloud
transcription.

## Screenshots

![Main view](./images/screenshot-main.png)

![Mobile](./images/screenshot-mobile.png)

> Drop your screenshots into `images/` with those filenames (or update the paths
> above).

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

## Install

Copy `main.js`, `manifest.json`, and `styles.css` into
`.obsidian/plugins/prosody/` and enable **Prosody** in
**Settings → Community plugins**.

## Setup

Prosody needs a transcription server and an ACP agent.

1. **Transcription server** — run any OpenAI-compatible `/v1/audio/transcriptions`
   server that also emits word timings (e.g. an Orukeet / sherpa-onnx server).
   Note its URL, e.g. `http://your-server:8178`.
2. **ACP agent** — install the agent(s) you want to summarize with, e.g.
   `opencode`, `claude-agent-acp`, or `codex-acp`. On mobile, put an ACP ↔
   WebSocket bridge in front of it.
3. **Settings → Prosody** — set the **Transcription URL**, enable or add agents,
   and pick a **Default agent**.

## Privacy & network access

- **Audio** is POSTed to the transcription endpoint you configure (default
  `http://127.0.0.1:8178`).
- **Summaries** connect to the `ws(s)://` (or stdio) ACP agent you configure.
- **Commands** you configure run locally on your machine (desktop).
- There is **no telemetry** and **no author or third-party servers**. Nothing is
  sent anywhere except the endpoints and commands you specify.

## Configure

**Settings → Prosody**

- **Transcription URL** / **Transcription token** — your self-hosted ASR
  endpoint (e.g. `http://your-server:8178`); the token is sent as a Bearer token.
- **Agents** — enable presets or add a custom one. A command (e.g. `opencode acp`)
  runs over stdio on desktop; a `wss://` URL connects to a remote bridge (works on
  mobile).
- **Default agent**, **Permissions** (auto-deny by default), **Prompt**,
  **Working directory**, **WSL** options, **Debug logging**.

The cog on each transcript opens a quick popup: agent, model (loaded live from
the agent's ACP config options), and permissions.

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

A WebSocket ↔ stdio bridge lets mobile clients reach a local agent. Endpoint:
`wss://host/acp/<agentId>?token=...` (root path defaults to opencode for
backwards compatibility).

## License

MIT

Prosody is not affiliated with or endorsed by Obsidian.
