## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/eranhirs/ai-fact-checker.git
cd ai-fact-checker

# Install dependencies
npm install

# Set up environment variables (for telemetry)
cp .env.example .env
# Edit .env with your GA4 credentials (optional)
```

### Build Commands

```bash
# Production build (outputs to dist/)
npm run build

# Development build with watch mode (auto-rebuilds on changes)
npm run dev

# Build the extension
rm ai-overview-fact-checker.zip && cd dist && zip -r ../compiled/ai-fact-checker.zip .
```


### Loading the Extension

1. Run `npm run build`
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" → select the `dist/` folder
5. After rebuilding, click the refresh icon on the extension card


### Project Structure

```
├── src/
│   ├── background.ts      # Service worker (API calls, state management)
│   ├── content-script.ts  # Injected into Google Search pages
│   ├── telemetry.ts       # GA4 analytics (opt-in)
│   └── sidepanel/         # React UI for the side panel
├── public/
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
├── dist/                  # Build output (load this in Chrome)
├── types.ts               # Shared TypeScript types
└── vite.config.ts         # Build configuration
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics 4 Measurement ID |
| `VITE_GA4_API_SECRET` | GA4 Measurement Protocol API secret |

These are optional and only needed if you want telemetry to work.

### Extracting Telemetry Data

#### Option 1: BigQuery (Recommended)

BigQuery export includes **all event parameters** automatically.

**Setup (one-time):**
1. **Enable BigQuery export**: GA4 Admin → BigQuery Links → Link to your GCP project
2. **Wait 24-48 hours** for data to start flowing
3. **Create service account**: GCP Console → IAM → Service Accounts → Create with "BigQuery Data Viewer" role

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
