# Chrome Web Store Listing Assets

## Basic Information

**Extension Name:** AI Fact Checker

**Short Description (max 132 characters):**
```
Verify AI output claims against their source citations using Gemini AI. Fact-check Google's AI summaries with one click.
```

**Category:** Productivity (or "Search Tools" if available)

**Language:** English

---

## Detailed Description

```
AI Fact Checker helps you verify the accuracy of AI summaries by cross-referencing claims with their original sources.

HOW IT WORKS
1. Search on Google and see an AI Overview
2. Highlight any claim you want to verify
3. Click "Verify Selection" to fact-check against source websites
4. Get a clear verdict: Supported, Partial, Unsupported, or Inconclusive

KEY FEATURES
- Automatic Detection: Instantly detects AI Overviews on Google Search results
- Smart Source Extraction: Automatically identifies and fetches content from cited sources
- AI-Powered Analysis: Uses Google's Gemini AI to compare claims against source material
- Evidence Display: Shows exact quotes from sources that support or contradict the claim
- Direct Links: Click through to source pages with the relevant text highlighted

WHY USE THIS?
AI outputs are helpful but can sometimes misrepresent or oversimplify information from sources. This extension gives you the tools to verify claims before trusting them.

PRIVACY-FOCUSED
- Your Gemini API key is stored locally on your device
- No data is sent to third-party servers by default (only to Google's Gemini API)
- Optional anonymous usage analytics (opt-in only) to help improve the extension
- No personal data collection

GETTING STARTED
1. Install the extension
2. Get a free Gemini API key from Google AI Studio
3. Enter your API key in the extension settings
4. Start fact-checking AI outputs!

Note: Requires a Google Gemini API key (free tier available at aistudio.google.com)
```

---

## Screenshots

You need **at least 1 screenshot** (1280x800 or 640x400 pixels). Here's what to capture:

### Screenshot 1: Main Interface (Required)
**What to show:** The side panel open with a verified claim showing "SUPPORTED" status
**How to capture:**
1. Go to Google and search for something that triggers an AI Overview (e.g., "how does photosynthesis work")
2. Open the extension side panel
3. Select some text from the AI Overview
4. Click "Verify Selection" and wait for results
5. Take a screenshot showing the green "SUPPORTED" result with evidence

**Suggested caption:** "Verify any AI output claim with one click"

### Screenshot 2: Source Detection
**What to show:** The sources list with green indicators showing fetched content
**How to capture:** Same as above, but focus on the sources section

**Suggested caption:** "Automatically fetches and analyzes source content"

### Screenshot 3: Unsupported/Partial Result
**What to show:** A result showing "PARTIAL" or "UNSUPPORTED" verdict
**How to capture:** Find an AI Overview with a slightly inaccurate claim and verify it

**Suggested caption:** "Get clear verdicts: Supported, Partial, Unsupported, or Inconclusive"

### Screenshot 4: Settings Panel
**What to show:** The settings panel open with API key input
**How to capture:** Click the gear icon to show settings

**Suggested caption:** "Easy setup with your own Gemini API key"

---

## Promotional Images (Optional but Recommended)

### Small Promotional Tile (440x280)
Create a simple graphic with:
- Extension icon
- Text: "AI Fact Checker"
- Tagline: "Verify AI claims instantly"

### Large Promotional Tile (920x680)
Create a graphic showing:
- Side-by-side of Google AI + extension panel
- Verification result highlighted
- "Powered by Gemini AI" badge

---

## Screenshot Capture Tips

1. **Use a clean browser profile** - No other extensions visible
2. **Use light mode** - Better visibility in store listings
3. **Ensure text is readable** - Zoom in if needed
4. **Highlight the key feature** - Use annotation arrows if helpful
5. **Consistent dimensions** - All screenshots should be the same size

### Quick Screenshot Command (macOS)
```bash
# Full window screenshot
Cmd + Shift + 4, then press Space, then click the window

# Or use Chrome DevTools for exact dimensions:
1. Open DevTools (Cmd + Option + I)
2. Click device toolbar (Cmd + Shift + M)
3. Set custom dimensions: 1280x800
4. Take screenshot from DevTools menu
```

---

## Store Listing Checklist

- [ ] Extension name (AI Fact Checker)
- [ ] Short description (132 chars max)
- [ ] Detailed description
- [ ] At least 1 screenshot (1280x800 or 640x400)
- [ ] Extension icon (already included: 16, 48, 128px)
- [ ] Category selected
- [ ] Language selected
- [ ] Privacy policy URL
- [ ] Single purpose description (for Chrome Web Store review)

---

## Single Purpose Description (Required by Chrome)

When submitting, Chrome asks for a "single purpose" justification. Use:

```
This extension has a single purpose: to fact-check claims made in Google's AI Overview search results by comparing them against their cited source websites using AI analysis.
```

---

## Permission Justifications (Required)

Chrome will ask why you need each permission:

| Permission | Justification |
|------------|---------------|
| storage | To save the user's Gemini API key and telemetry preferences locally |
| sidePanel | To display the fact-checking interface in Chrome's side panel |
| activeTab | To detect AI Overview content on the current Google Search page |
| scripting | To inject a content script that detects text selection in AI outputs |
| host_permissions (<all_urls>) | To fetch content from source websites cited in AI outputs for fact-checking comparison |
