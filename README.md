  To install and test:

  1. Open Chrome and go to chrome://extensions/
  2. Enable "Developer mode" (toggle in top right)
  3. Click "Load unpacked"
  4. Select the dist folder: /Users/hirsche/git/attribution-queries-extension/dist

  How it works:

  1. Navigate to Google and search for something that generates an AI Overview
  2. The extension auto-detects the AI Overview and opens the side panel
  3. Click the gear icon to set your Gemini API key
  4. Select text from the AI Overview
  5. Click "Verify Selection" to fact-check the claim against source citations

  Development:
  - Run npm run dev for watch mode (rebuilds on changes)
  - Run npm run build for production build