# FormulaR

An Obsidian plugin that automatically validates and completes LaTeX mathematical derivations inside `\begin{align}...\end{align}` blocks.

## Features

- **Real-time validation** — detects algebraic errors in each step of a derivation as you type, highlighting incorrect lines with a red wavy underline
- **Uncertain-step marking** — lines that cannot be verified locally are marked with an orange dashed underline and optionally sent to an AI for a second check
- **Hover tooltips** — hover over a marked line to see a brief explanation of the error or uncertainty
- **AI-powered next-step suggestions** — type `\\` at the end of a derivation block to get autocomplete suggestions for the next step, powered by any Claude or OpenAI-compatible API
- **Offline local validation** — algebraic equivalence is checked first with [mathjs](https://mathjs.org/), so basic errors are caught without any API call

## Requirements

- Obsidian desktop (v0.15.0 or later)
- An API key for [Anthropic Claude](https://console.anthropic.com/) or any OpenAI-compatible endpoint (optional — local validation works without one)

## Installation

### Community Plugin (recommended)

1. Open **Settings → Community plugins → Browse**
2. Search for **FormulaR**
3. Click **Install**, then **Enable**

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/danieldaidai/FormulaR/releases/latest)
2. Copy them to `<your vault>/.obsidian/plugins/FormulaR/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

## Configuration

Open **Settings → FormulaR** to configure the following options:

| Setting | Default | Description |
| --- | --- | --- |
| API Base URL | `https://api.anthropic.com` | Claude or any OpenAI-compatible endpoint (e.g. Ollama, OpenAI, local models) |
| API Key | *(empty)* | API key for the above endpoint; leave empty for local-only Ollama |
| Model | `claude-3-5-haiku-20241022` | Model ID to use for validation and suggestions |
| Validation delay (ms) | `1500` | How long to wait after you stop typing before triggering validation |
| Enable local validation | on | Use mathjs for algebraic equivalence checking (works offline) |
| Enable AI validation | on | Call the AI when local validation is inconclusive |
| Enable autocomplete | on | Suggest next steps when you type `\\` at the end of an align block |

## Usage

Write a LaTeX derivation inside an `align` environment in any note:

~~~latex
$$
\begin{align}
(x+1)^2 &= x^2 + 2x + 1 \\
&= x^2 + 3x + 1
\end{align}
$$
~~~

FormulaR will automatically:

1. Parse each step of the derivation
2. Verify algebraic equivalence between consecutive lines using mathjs
3. Mark incorrect lines with a red wavy underline
4. Optionally ask the configured AI to explain the error on hover
5. Offer next-step suggestions when you type `\\` at the end of the block

## Privacy

When AI validation or autocomplete is enabled, the content of the `align` block being validated is sent to the configured API endpoint. No other vault content is transmitted. Disable **Enable AI validation** and **Enable autocomplete** to keep everything fully local.

## License

[MIT](LICENSE)
