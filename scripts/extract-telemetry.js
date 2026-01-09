#!/usr/bin/env node

/**
 * Extract telemetry data from Google Analytics 4
 *
 * Setup:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com
 * 2. Create a project (or use existing)
 * 3. Enable "Google Analytics Data API"
 * 4. Create a Service Account with "Viewer" role
 * 5. Download the JSON key file
 * 6. Add the service account email to your GA4 property (Admin > Property Access Management)
 * 7. Set GOOGLE_APPLICATION_CREDENTIALS env var to point to the JSON key file
 *
 * Usage:
 *   node scripts/extract-telemetry.js [--days=7] [--output=csv|json] [--custom]
 *
 * Options:
 *   --days=N     Number of days to fetch (default: 7)
 *   --output     Output format: json (default) or csv
 *   --custom     Include custom dimensions (must be registered in GA4 first)
 *
 * Examples:
 *   GA4_PROPERTY_ID=123456789 GOOGLE_APPLICATION_CREDENTIALS=./key.json npm run telemetry
 *   GA4_PROPERTY_ID=123456789 GOOGLE_APPLICATION_CREDENTIALS=./key.json npm run telemetry:csv > data.csv
 *
 * To use custom dimensions (--custom), first register them in GA4:
 *   Admin > Custom definitions > Create custom dimensions
 *   Add: domain, success, verification_status, source_count, evidence_count, verify_duration_ms, claim_length
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Configuration
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || ''; // e.g., '123456789'

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const DAYS = parseInt(args.days) || 7;
const OUTPUT_FORMAT = args.output || 'json';

async function extractTelemetry() {
  if (!GA4_PROPERTY_ID) {
    console.error('Error: GA4_PROPERTY_ID environment variable is required');
    console.error('Find your Property ID in GA4: Admin > Property Settings > Property ID');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is required');
    console.error('Set it to the path of your service account JSON key file');
    process.exit(1);
  }

  const analyticsDataClient = new BetaAnalyticsDataClient();

  console.error(`Fetching telemetry data for last ${DAYS} days...`);

  try {
    // Build dimensions list - start with standard dimensions
    const dimensions = [
      { name: 'date' },
      { name: 'eventName' },
    ];

    // Add custom dimensions if registered (set via --custom flag)
    const useCustomDimensions = args.custom === true;
    if (useCustomDimensions) {
      dimensions.push(
        { name: 'customEvent:domain' },
        { name: 'customEvent:success' },
        { name: 'customEvent:verification_status' },
        { name: 'customEvent:source_count' },
        { name: 'customEvent:evidence_count' },
        { name: 'customEvent:verify_duration_ms' },
        { name: 'customEvent:claim_length' },
      );
    }

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${DAYS}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions,
      metrics: [
        { name: 'eventCount' },
      ],
    });

    const rows = [];

    if (response.rows) {
      for (const row of response.rows) {
        let rowData;
        if (useCustomDimensions) {
          rowData = {
            date: row.dimensionValues[0]?.value,
            eventName: row.dimensionValues[1]?.value,
            domain: row.dimensionValues[2]?.value,
            success: row.dimensionValues[3]?.value,
            verificationStatus: row.dimensionValues[4]?.value,
            sourceCount: row.dimensionValues[5]?.value,
            evidenceCount: row.dimensionValues[6]?.value,
            verifyDurationMs: row.dimensionValues[7]?.value,
            claimLength: row.dimensionValues[8]?.value,
            eventCount: row.metricValues[0]?.value,
          };
        } else {
          rowData = {
            date: row.dimensionValues[0]?.value,
            eventName: row.dimensionValues[1]?.value,
            eventCount: row.metricValues[0]?.value,
          };
        }
        rows.push(rowData);
      }
    }

    if (OUTPUT_FORMAT === 'csv') {
      // CSV output
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        console.log(headers.join(','));
        for (const row of rows) {
          console.log(headers.map(h => `"${row[h] || ''}"`).join(','));
        }
      }
    } else {
      // JSON output
      console.log(JSON.stringify(rows, null, 2));
    }

    console.error(`\nTotal rows: ${rows.length}`);

  } catch (error) {
    console.error('Error fetching data:', error.message);
    if (error.message.includes('permission')) {
      console.error('\nMake sure the service account has access to your GA4 property.');
      console.error('Go to GA4 Admin > Property Access Management > Add the service account email.');
    }
    process.exit(1);
  }
}

// Summary statistics
async function extractSummary() {
  if (!GA4_PROPERTY_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }

  const analyticsDataClient = new BetaAnalyticsDataClient();

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${DAYS}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [
        { name: 'eventName' },
      ],
      metrics: [
        { name: 'eventCount' },
      ],
    });

    console.error('\n--- Summary ---');
    if (response.rows) {
      for (const row of response.rows) {
        console.error(`${row.dimensionValues[0]?.value}: ${row.metricValues[0]?.value} events`);
      }
    }
  } catch (error) {
    // Ignore summary errors
  }
}

async function main() {
  await extractTelemetry();
  if (OUTPUT_FORMAT === 'json') {
    await extractSummary();
  }
}

main();
