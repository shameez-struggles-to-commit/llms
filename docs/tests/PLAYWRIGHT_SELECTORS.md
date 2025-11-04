# Stable UI selectors for Playwright (MCP)

This app exposes stable data-testid attributes to make end-to-end automation reliable using the existing Playwright capability available in your MCP environment.

Use these selectors to drive core chat and multimodal flows without relying on CSS classes or volatile DOM structure.

## Global

- App root: css=[data-testid="chat-prompt"]
- Model selector container: css=[data-testid="model-selector-container"]
- Model selector: css=[data-testid="model-selector"]
- Provider status widget: css=[data-testid="provider-status"]

## Chat input area

- Message textarea: css=[data-testid="chat-input"]
- Send button (non-streaming): css=[data-testid="send-button"]
- Cancel button (while request is in-flight): css=[data-testid="cancel-button"]
- Attach (+) button: css=[data-testid="attach-button"]
- Hidden file input: css=[data-testid="file-input"]
- Settings gear button: css=[data-testid="settings-button"]
- Attachments container (visible when one or more files are attached): css=[data-testid="attachments"]
- Specific attachment chip (0-based index): css=[data-testid="attachment-item-<index>"]
- No model warning text (shown if model not selected): css=[data-testid="no-model-warning"]

## Model options

When the model picker is expanded, each model entry renders with a deterministic test id based on the logical model id (the value you pass to `-m` on the CLI and that appears in `/models`):

- Model option: css=[data-testid="model-option-<MODEL_ID>"]
  - Example: css=[data-testid="model-option-llama3.1:8b"]

Tip: Prefer using these test ids over text matching to avoid brittle tests if display names or prices change.

## Typical flows

Below are high-level steps you can automate with Playwright. These are intentionally tooling-agnostic so you can translate them directly into your MCP Playwright commands:

### 1) App loads and config is healthy

- Navigate to http://localhost:8000
- Wait for css=[data-testid="model-selector"] to be visible
- Assert that the page did not show css=[data-testid="no-model-warning"] (default model is valid)

### 2) Select the default AI Refinery model (if needed)

- Click css=[data-testid="model-selector"] to open the dropdown
- Click css=[data-testid="model-option-llama3.1:8b"]
- Verify that the selector now reflects the chosen model (optional visual assertion) or proceed directly to messaging

### 3) Send a basic text message

- Fill css=[data-testid="chat-input"] with "Hello from Playwright!"
- Click css=[data-testid="send-button"]
- Wait for css=[data-testid="cancel-button"] to disappear (request finished)
- Assert that the last assistant bubble appears with some content (e.g., by locating the last `.message` with AI role)

### 4) Vision: attach an image and ask a question

- Click css=[data-testid="attach-button"]
- Set input files on css=[data-testid="file-input"] with an image (e.g., png/jpg)
- Verify css=[data-testid="attachments"] becomes visible
- Fill css=[data-testid="chat-input"] with a prompt like "Describe the key features of the image"
- Click css=[data-testid="send-button"]
- Wait for completion, assert assistant response is rendered

### 5) Cancel an in-flight request

- Start a long-running query (e.g., a very open-ended prompt)
- When css=[data-testid="cancel-button"] appears, click it
- Verify the request stops and the input regains focus

## Notes

- The default text model is set to `llama3.1:8b`, which is pre-mapped to AI Refinery (`meta-llama/Llama-3.1-8B-Instruct`). If your API key is set and the provider is enabled, the app will be ready to chat immediately on first load.
- Attachments support images, audio, and files; the chat request builder automatically converts them to appropriate data URIs.
- The app returns non-streaming JSON by default. Usage and metadata (including pricing when available) are recorded per request.

If you need an additional selector for a scenario not covered above, open an issue or extend the markup with another `data-testid`.
