# AI Fact Checker

A Chrome extension that helps users verify claims in AI output by checking them against source citations using Gemini.

![AI Fact Checker](https://raw.githubusercontent.com/eranhirs/ai-fact-checker/main/public/screenshot.jpg)

## Motivation

Large Language Models (LLMs) are increasingly used to generate content, including Google's AI Overviews in search results. While these AI-generated summaries often include source citations, users may want to verify whether the generated text is actually supported by the cited sources.

Research has shown that **localized attribution**—the ability to request attribution for specific spans of LLM-generated text—helps users better verify AI-generated content. Rather than relying on broad sentence-level citations, users can highlight specific claims and check them against the source material.

This extension implements this concept by allowing users to:
1. Select any text from an AI output
2. Automatically identify relevant source URLs near the selection
3. Fetch and analyze the source content
4. Use Gemini to verify whether the selected claim is supported by the sources
5. View supporting evidence with direct links that highlight the relevant text

For more details on localized attribution queries, see the [LAQuer paper](https://arxiv.org/abs/2506.01187).

## Installation

### Prerequisites
- Google Chrome browser
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier available)

### Steps

1. **Download the extension**
   ```bash
   git clone https://github.com/eranhirs/ai-fact-checker.git
   cd ai-fact-checker
   ```

2. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   ```

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `dist` folder from the cloned repository

4. **Configure your API key**
   - Click the extension icon in Chrome's toolbar
   - Click the gear icon to open settings
   - Enter your Gemini API key and click "Save"

## Usage

1. Go to [Google Search](https://www.google.com) and search for something that triggers an AI Overview
2. When an AI Overview is detected, you'll see a purple "AI" badge on the extension icon
3. Click the extension icon to open the side panel
4. Select/highlight any text from the AI Overview that you want to verify
5. Click "Verify Selection" to check the claim against the sources
6. View the results:
   - **Supported**: The claim is backed by the sources
   - **Partial**: Some parts of the claim are supported
   - **Unsupported**: The claim contradicts the sources
   - **Inconclusive**: The sources don't contain relevant information
7. Click on evidence links to open the source page with the supporting text highlighted

## Privacy & Telemetry

This extension prioritizes your privacy:

- **Local storage**: Your Gemini API key and preferences are stored locally on your device
- **No tracking by default**: The extension does not collect any usage data unless you opt in

### Optional Telemetry

You can optionally enable anonymous usage analytics to help improve the extension. This is **disabled by default** and must be explicitly enabled in Settings.

| Level | What's Collected |
|-------|------------------|
| Off (Default) | Nothing |
| Statistics | Domain of verified pages, success/failure |
| Verbose | Full URLs, claim text, results, timing |

Telemetry data is sent to Google Analytics and cannot be used to identify you. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.


**Extract data:**
```bash
BIGQUERY_PROJECT_ID=your-gcp-project \
BIGQUERY_DATASET_ID=analytics_123456789 \
GOOGLE_APPLICATION_CREDENTIALS=./key.json \
npm run telemetry:bq

# CSV output for last 30 days:
npm run telemetry:bq:csv -- --days=30 > telemetry.csv
```

The dataset ID is usually `analytics_YOUR_PROPERTY_ID` (find in BigQuery console).

#### Option 2: GA4 Data API

For basic event counts (without custom parameters):

```bash
GA4_PROPERTY_ID=123456789 \
GOOGLE_APPLICATION_CREDENTIALS=./key.json \
npm run telemetry
```

## Limitations

- **AI-generated responses**: This extension uses an LLM to verify claims which can make mistakes.
- **AI-generated code**: This extension was generated using [Claude Code](https://claude.ai/claude-code) by Anthropic. While functional, the code may not follow all best practices.
- **Source detection**: The extension uses heuristics to detect AI Overviews and extract source URLs, which may not work perfectly on all Google Search variations or locales.
- **CORS restrictions**: Some websites may block content fetching due to CORS policies.
- **Text fragment support**: The "scroll to text" highlighting feature requires Chrome and may not work on all websites.
- **API costs**: While Gemini has a free tier, heavy usage may incur costs.
- **Content extraction**: HTML-to-text conversion uses regex-based parsing which may not perfectly extract content from all websites.

## Citation

If you use this extension or find it helpful for your research, please cite the LAQuer paper:

```bibtex
@inproceedings{hirsch-etal-2025-laquer,
    title = "{LAQ}uer: Localized Attribution Queries in Content-grounded Generation",
    author = "Hirsch, Eran  and
      Slobodkin, Aviv  and
      Wan, David  and
      Stengel-Eskin, Elias  and
      Bansal, Mohit  and
      Dagan, Ido",
    booktitle = "Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)",
    month = jul,
    year = "2025",
    address = "Vienna, Austria",
    publisher = "Association for Computational Linguistics",
}
```

**Paper**: [LAQuer: Localized Attribution Queries in Content-grounded Generation](https://arxiv.org/abs/2506.01187)

**GitHub**: [https://github.com/eranhirs/LAQuer](https://github.com/eranhirs/LAQuer)

## License

MIT
