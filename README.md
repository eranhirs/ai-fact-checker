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

**[Available on the Chrome Web Store](https://chromewebstore.google.com/detail/ai-fact-checker/ajlnhclklmceofjieakhamopoieiagmj)**

## Usage

https://github.com/user-attachments/assets/fc9075ca-46ef-4298-a6ff-0492bd1b8806

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

- **Local storage**: Your Gemini API key and preferences are stored locally on your device
- **No tracking by default**: The extension does not collect any usage data unless you opt in
- See full privacy policy [here](https://github.com/eranhirs/ai-fact-checker/blob/main/PRIVACY_POLICY.md)

## Limitations

- **Search results**: The extension only searches within citations (URLs) available in the current page.
- **AI-generated responses**: This extension uses an LLM to verify claims which can make mistakes.
- **AI-generated code**: This extension was generated using [Claude Code](https://claude.ai/claude-code) by Anthropic. While functional, the code may not follow all best practices.
- **Source detection**: The extension uses heuristics to detect AI Overviews and extract source URLs, which may not work perfectly on all Google Search variations or locales.
- **CORS restrictions**: Some websites may block content fetching due to CORS policies.
- **API costs**: While Gemini has a free tier, heavy usage may incur costs.
- **Content extraction**: The extension may not perfectly extract content from all websites.

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
