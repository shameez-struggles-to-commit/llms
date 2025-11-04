# AI Refinery integration: implementation + roadmap

This document captures the learnings, design decisions, current implementation, and a detailed roadmap to fully integrate Accenture’s AI Refinery into this llms.py application, without Docker, targeting Windows packaging to a single EXE.

## TL;DR
- Runtime: Python 3.12+ (enforced). No Docker required.
- Dependency: `airefinery-sdk>=1.21.0` is installed and pinned.
- Auth: Single API key via `AIREFINERY_API_KEY` (Bearer).
- Endpoints: OpenAI‑compatible REST at `https://api.airefinery.accenture.com` (e.g., `/v1/chat/completions`).
- MVP done: Non‑streaming chat + vision using the official AI Refinery SDK by default (with HTTP fallback). Windows UTF‑8 file writes fixed.
- Next: Streaming, image generation, audio, Distiller (multi‑agent), E2E via MCP’s Playwright tool, Windows EXE packaging.

## Background and key learnings
- llms.py server is an `aiohttp` app with a Vue SPA. The UI expects a non‑streaming OpenAI ChatCompletion JSON containing `choices`, `usage`, and `metadata.pricing`/`duration`.
- The server already normalizes multimodal content (images/audio/files) into base64 data URIs before forwarding to a provider.
- AI Refinery provides OpenAI‑compatible REST endpoints (chat, models, etc.). The default base URL is defined in the SDK as `https://api.airefinery.accenture.com`. Auth is a single Bearer token.
- We now route chat + images via the official SDK by default. While the REST interface is OpenAI‑compatible, the SDK adds required headers (e.g., `sdk_version`) and handles nuances that some environments expect. We keep a transparent HTTP fallback path to remain resilient.

## What's implemented now (MVP)
- Provider: Added `airefinery` under `llms/llms.json` using `AirRefineryProvider` (SDK‑backed) with base URL `https://api.airefinery.accenture.com` and `api_key` from `AIREFINERY_API_KEY`. Includes a curated set of model mappings. If the SDK is not importable, it automatically falls back to OpenAI‑compatible HTTP.
- **✅ Dynamic Model Loading**: The provider now dynamically fetches all available models from AI Refinery's `/v1/models` API endpoint using `AsyncAIRefinery.models.list()`. Currently loading 42+ models including:
  - Chat models (Llama 3.1/3.2/3.3, Mistral, Qwen3, DeepSeek, GPT-OSS)
  - Vision models (Llama 3.2 90B Vision)
  - Embedding models (E5, multilingual-e5, Qwen3 Embedding, NVIDIA NV-EmbedQA)
  - Image generation (FLUX.1-schnell)
  - Audio (Azure AI Speech, Azure AI Transcription)
  - Specialized models (rerankers, segmentation, knowledge brain)
- **✅ Chat Functionality**: Fully tested and working with AI Refinery models via the official SDK. Non-streaming chat completions return proper OpenAI-compatible responses with usage metadata.
- **✅ Vision Support**: Vision models (llama3.2:90b-vision) are available and properly mapped. The application's existing multimodal preprocessing (image download/base64 conversion) integrates seamlessly.
- Python only (no Docker):
  - `requirements.txt`: added `airefinery-sdk>=1.21.0`.
  - `pyproject.toml` and `setup.py`: set `python_requires`/`requires-python` to `>=3.12`; added dependencies to include Pillow and AI Refinery SDK.
- Windows robustness: Fixed Unicode issues by forcing UTF‑8 when creating `~/.llms/llms.json` and `~/.llms/ui.json`.
- Docs and env: `.env.example` has `AIREFINERY_API_KEY`. README environment matrix includes AI Refinery.

## How to run (Python 3.12+, no Docker)

### Option A: Windows single-file launcher

1) Set `AIREFINERY_API_KEY` in `.env` at repo root

2) Run `launch.ps1` in PowerShell

The launcher loads `.env`, installs deps, initializes `~/.llms` config if needed, and starts the server on port 8000 using the repo config (so AI Refinery is enabled when the key is present). It then opens your browser to the UI.

### Option B: Manual commands
1) Install dependencies

Windows PowerShell:

```powershell
# From repo root or llms-main folder
C:/Users/shameez.manji/AppData/Local/Programs/Python/Python312/python.exe -m pip install --upgrade pip
C:/Users/shameez.manji/AppData/Local/Programs/Python/Python312/python.exe -m pip install -r requirements.txt
C:/Users/shameez.manji/AppData/Local/Programs/Python/Python312/python.exe -m pip install -e .
```

2) Set your API key

```powershell
$env:AIREFINERY_API_KEY = "<your-air-key>"
$env:HOME = "$env:USERPROFILE"
```

3) Initialize default configs (first run only)

```powershell
llms --init
```

4) Start the server

```powershell
llms --serve 8000 --verbose
```

- UI: http://localhost:8000
- API: POST http://localhost:8000/v1/chat/completions

5) Try chat and vision

- Chat (CLI):

```powershell
llms -m "llama3.1:8b" "Summarize the value of using llms.py with AI Refinery."
```

- Vision (CLI):

```powershell
llms -m "llama3.2:90b-vision" --image .\sample.jpg "Describe the key features of this image"
```

Notes
- Provider auto‑routing works across enabled providers; your `AIREFINERY_API_KEY` must be set for `airefinery` to be active.
- The UI can enable/disable providers at runtime next to the model selector.

## Implementation details (code)
- `llms/llms.json`: Added `airefinery` provider and model map; enabled by default. Default pricing set to 0/0 (update once pricing is finalized).
- `llms/main.py`: UTF‑8 enforced when creating `~/.llms/llms.json` and `~/.llms/ui.json`. `process_chat()` already downloads/normalizes images/audio/files as data URIs compatible with OpenAI‑style APIs.
- `requirements.txt`: now includes `airefinery-sdk>=1.21.0` in addition to `aiohttp` and `Pillow`.
- Packaging metadata: `pyproject.toml` and `setup.py` updated to require Python 3.12+ and include dependencies. This ensures correctness when installed from source or built.

## Why the SDK is used by default
- In practice, some deployments expect SDK-added headers (notably `sdk_version`) and behavior; using the SDK by default avoids subtle auth/compliance issues and keeps us aligned with AIR best practices.
- The SDK is also required/recommended for:
  - Distiller (multi‑agent orchestration, executors, streaming over websockets)
  - Knowledge Graph / embeddings utilities
  - Optional PII masking support (`[pii]` extra)
- We still retain an HTTP fallback so that behavior remains robust if the SDK is not available for any reason.

## Validation checklists
- CLI
  - `llms --help` shows commands
  - `llms --init` creates `~/.llms/llms.json` and `~/.llms/ui.json` without encoding errors on Windows
  - `llms --list` shows providers; `airefinery` must appear enabled once API key is set
  - `llms -m "llama3.1:8b" "Hello"` returns an answer when a valid key is present
- API
  - `POST /v1/chat/completions` accepts OpenAI ChatCompletion and returns the same shape with `metadata.duration` and optional `metadata.pricing`
  - Vision requests include `image_url.url` as a data URI and complete successfully
- UI
  - Chat end‑to‑end works; vision uploads or URLs work; usage/pricing metadata renders without breaking the UI.

## Roadmap (detailed)

### ✅ Completed
1) **Dynamic Model Loading** ✅
   - Implemented `AsyncAIRefinery.models.list()` integration in `AirRefineryProvider.load()`
   - Merges statically configured aliases with live API models
   - Successfully loading 42+ models across all categories (chat, vision, embeddings, image gen, audio)
   - Preserves user-friendly aliases (e.g., `qwen3:32b` → `Qwen/Qwen3-32B`)

2) **Chat Completion** ✅
   - Working end-to-end with AI Refinery models via official SDK
   - Tested with qwen3:32b: proper responses, usage tracking, metadata
   - SDK adds required headers (`Authorization`, `sdk_version`) automatically
   - Falls back to HTTP if SDK unavailable

3) **Vision/Multimodal Support** ✅
   - Vision models available (llama3.2:90b-vision)
   - Existing image preprocessing (download, base64 conversion, resize/webp optimization) works with AI Refinery
   - Ready for image input testing (limited by Playwright MCP file upload constraints)

### 🚧 Next Steps
1) Streaming support (server + UI)
   - Server: Extend to optionally stream OpenAI ChatCompletion chunks; preserve current non‑streaming default.
   - UI: Add a streaming mode toggle; progressively render tokens. Keep JSON shape on final assemble.
   - Tests: Simulate streamed responses, confirm back‑pressure and cancel.

2) Image generation API
   - Add a POST route that proxies to AI Refinery's image generation endpoint (black-forest-labs/flux.1-schnell available).
   - UI: New "Generate Image" pane with prompt, size, and negative prompt (if supported). Save/download images.
   - Tests: Snapshot image bytes, content‑type assertions.

3) Audio (transcription and TTS)
   - Expose ASR (transcription) and TTS endpoints (Azure AI Speech/Transcription available in model list).
   - UI: Upload audio; return transcript; optional TTS playback.
   - Tests: Goldens for short audio snippets; MIME handling.

4) Distiller (multi‑agent) integration
   - Use `air.AsyncAIRefinery` Distiller client from the SDK to create/download projects and connect.
   - Server: Add endpoints for:
     - Register/validate project (`POST /distiller/project` → SDK `create_project` / `validate_config`).
     - Run interactive session with optional streaming (`/distiller/query` via websockets or server‑sent events).
     - Upload project YAML and optional custom executors mapping.
   - UI: Basic shell for multi‑agent chat; agent selection; intermediate events (thoughts, references) display.
   - Security: Continue to honor single API key or GitHub OAuth.
   - Tests: Mock executor functions; end‑to‑end flows including PII masking when `[pii]` extra is installed.

5) UI/E2E tests via MCP Playwright
  - Use the existing Playwright tool in your MCP environment (no Python Playwright dependency in this repo).
  - Scenarios: Chat, Vision, Provider enable/disable, Auth (if enabled), Streaming on/off, Distiller happy path.
  - CI: Drive tests through the MCP tool to keep runtime dependencies minimal.

6) Windows single‑EXE packaging
   - Tooling: PyInstaller (or Nuitka) build targeting Python 3.12; include `llms/ui` assets.
   - Spec file: Ensure package data (index.html, ui/*) is collected; verify `aiohttp` and SSL hooks.
   - Output: `llms.exe` supporting both CLI and `--serve` modes.
   - Smoke tests: Run EXE with `--help`, `--init`, `--serve 8000`.

7) Upstream sync strategy
   - Keep diffs minimal. Submit UTF‑8 Windows fix upstream; keep AI Refinery provider in a dedicated section.
   - Rebase local fork regularly and keep the plan doc in `docs/` to minimize conflicts.

## Distiller design sketch (for implementation phase)
- SDK
  - `from air import AsyncAIRefinery` (already available via requirements)
- Server endpoints (proposed)
  - `POST /distiller/project` → body: `{ project, configYaml? | configJson? }`
    - Calls `client.distiller.create_project(...)`
    - Returns 201/409 per server response
  - `POST /distiller/validate` → body: `{ configYaml? | configJson? }`
    - Calls `client.distiller.validate_config(...)`
  - `WS /distiller/query?project=...&uuid=...` → messages forwarded between UI and SDK client (streaming)
    - Handles PII masking if enabled in project config; optional `[pii]` extra installed

No code is added yet for these endpoints; this section serves as the blueprint for the upcoming implementation.

## Configuration and environment
- Required
  - Python 3.12+
  - `AIREFINERY_API_KEY`
- Optional
  - `AIR_BASE_URL` to override the default base URL if needed (the SDK honors this; our provider uses `llms.json` base_url).
  - `VERBOSE=1` or `--verbose` for detailed logs.

## Known constraints and assumptions
- Pricing metadata for AI Refinery models is currently set to `0/0` until official token prices are finalized; the UI will still display usage and duration.
- The MVP keeps non‑streaming responses to match the current UI. Streaming is planned and will be opt‑in.

## Ownership and next steps
- With the SDK installed and Python 3.12+ enforced, the app is ready to run chat + vision against AI Refinery today.
- Next: enable streaming, then implement image generation and audio, followed by Distiller endpoints and E2E tests, and finally Windows EXE packaging.
