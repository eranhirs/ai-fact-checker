# Privacy Policy for AI Fact Checker

**Last Updated:** January 2026

## Overview

AI Fact Checker is a Chrome extension that helps users verify claims made by AI by cross-referencing them with their cited sources using Google's Gemini AI.

## Data Collection and Usage

### What We Collect

This extension collects and processes the following data **locally on your device**:

1. **Selected Text**: When you highlight text in an AI output, that text is temporarily processed to send to the Gemini API for verification.

2. **Source URLs**: URLs from the AI output's citations and nearby search results are collected to fetch their content for fact-checking.

3. **Gemini API Key**: Your personal Google Gemini API key is stored locally in Chrome's storage to authenticate API requests.

### What We Do NOT Collect (By Default)

- We do **not** collect personal information (name, email, etc.)
- We do **not** track your browsing history
- We do **not** store your search queries permanently
- By default, we do **not** send any usage data to analytics services

## Optional Telemetry (Opt-In)

You can optionally enable anonymous usage analytics to help improve the extension. **Telemetry is OFF by default** and must be explicitly enabled in Settings.

### Telemetry Levels

| Level | What's Collected |
|-------|------------------|
| **Off** (Default) | Nothing - no data sent |
| **Statistics** | Domain of verified pages, success/failure status, number of sources |
| **Verbose** | Statistics data + full URLs, claim text, source URLs, verification results, timing data |

### How Telemetry Works

- Telemetry data is sent to Google Analytics
- An anonymous client ID is generated (not linked to your identity)
- No personal information is ever collected
- You can disable telemetry at any time in Settings

### Why We Offer Telemetry

Anonymous usage data helps us:
- Understand which types of claims users verify most
- Identify performance issues
- Prioritize improvements
- Fix bugs

Telemtry data can be used for academic research purposes.

### Telemetry Data Handling

- Data is processed according to [Google Analytics Terms of Service](https://marketingplatform.google.com/about/analytics/terms/us/)
- We cannot identify individual users from telemetry data
- Verbose claim text is truncated to 500 characters maximum

## Third-Party Services

### Google Gemini API

When you verify a claim, the following data is sent to Google's Gemini API:
- The text you selected for verification
- Content fetched from source URLs

This data is processed according to [Google's Privacy Policy](https://policies.google.com/privacy) and [Google AI Terms of Service](https://ai.google.dev/terms).

### Source Websites

To verify claims, the extension fetches publicly available content from URLs cited in the AI output. This is similar to visiting those websites directly in your browser.

### Google Analytics (Optional)

If you opt into telemetry, anonymous usage data is sent to Google Analytics. This data is processed according to [Google's Privacy Policy](https://policies.google.com/privacy) and the [Google Analytics Terms of Service](https://marketingplatform.google.com/about/analytics/terms/us/).

## Data Storage

- **API Key**: Stored locally using Chrome's `chrome.storage.local` API. This data never leaves your device except when making authenticated requests to the Gemini API.
- **Verification Results**: Displayed in the extension's side panel but not permanently stored.
- **Telemetry Preference**: Your telemetry opt-in preference is stored locally.
- **Anonymous Client ID**: If telemetry is enabled, an anonymous UUID is generated and stored locally for analytics session tracking.

## Data Security

- All API communications use HTTPS encryption
- Your API key is stored only on your local device
- No data is transmitted to any servers controlled by the extension developers

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `storage` | To save your Gemini API key locally |
| `sidePanel` | To display the verification interface |
| `activeTab` | To detect AI outputs on the current page |
| `scripting` | To inject the content script that detects text selection |
| `<all_urls>` | To fetch content from source websites for fact-checking |

## Your Rights

- **Access**: Your API key can be viewed in the extension's settings
- **Deletion**: Uninstalling the extension removes all locally stored data
- **Control**: You choose when to verify claims; nothing is automatic
- **Telemetry Control**: You can enable, disable, or change your telemetry level at any time in Settings

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

## Open Source

This extension is open source. You can review the complete source code to verify our privacy practices.
