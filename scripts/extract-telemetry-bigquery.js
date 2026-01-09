#!/usr/bin/env node

/**
 * Extract telemetry data from BigQuery (GA4 export)
 *
 * Setup:
 * 1. Enable BigQuery export in GA4: Admin > BigQuery Links > Link
 * 2. Wait 24-48 hours for data to start flowing
 * 3. Set up authentication (same as before - service account with BigQuery access)
 *
 * Usage:
 *   node scripts/extract-telemetry-bigquery.js [--days=7] [--output=csv|json]
 *
 * Environment variables:
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to service account JSON key
 *   BIGQUERY_PROJECT_ID - Your GCP project ID
 *   BIGQUERY_DATASET_ID - Usually "analytics_PROPERTY_ID" (e.g., analytics_123456789)
 *   BIGQUERY_LOCATION - Dataset location: US (default), EU, asia-northeast1, etc.
 */

import { BigQuery } from '@google-cloud/bigquery';

// Configuration
const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID || '';
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || ''; // e.g., 'analytics_123456789'
const LOCATION = process.env.BIGQUERY_LOCATION || 'US'; // e.g., 'US', 'EU', 'asia-northeast1'

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const DAYS = parseInt(args.days) || 7;
const OUTPUT_FORMAT = args.output || 'json';

async function extractTelemetry() {
  if (!PROJECT_ID) {
    console.error('Error: BIGQUERY_PROJECT_ID environment variable is required');
    process.exit(1);
  }

  if (!DATASET_ID) {
    console.error('Error: BIGQUERY_DATASET_ID environment variable is required');
    console.error('Usually "analytics_YOUR_PROPERTY_ID" (e.g., analytics_123456789)');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is required');
    process.exit(1);
  }

  const bigquery = new BigQuery({ projectId: PROJECT_ID, location: LOCATION });

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS);

  const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  console.error(`Fetching telemetry data from ${startDateStr} to ${endDateStr}...`);

  // Query to extract telemetry events with all parameters
  const query = `
    SELECT
      event_date,
      event_timestamp,
      event_name,
      -- Extract event parameters
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'domain') as domain,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'success') as success,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'verification_status') as verification_status,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'source_count') as source_count,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'evidence_count') as evidence_count,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'verify_duration_ms') as verify_duration_ms,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'claim_length') as claim_length,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'full_url') as full_url,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'claim_text') as claim_text,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source_urls') as source_urls,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'error_message') as error_message,
      -- User/session info
      user_pseudo_id,
      geo.country as country,
      device.category as device_category,
      device.operating_system as os
    FROM
      \`${PROJECT_ID}.${DATASET_ID}.events_*\`
    WHERE
      _TABLE_SUFFIX BETWEEN '${startDateStr}' AND '${endDateStr}'
      AND event_name IN ('verification_started', 'verification_completed', 'verification_error')
    ORDER BY
      event_timestamp DESC
  `;

  try {
    const [rows] = await bigquery.query({ query });

    if (OUTPUT_FORMAT === 'csv') {
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        console.log(headers.join(','));
        for (const row of rows) {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            // Escape quotes and wrap in quotes
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          console.log(values.join(','));
        }
      }
    } else {
      console.log(JSON.stringify(rows, null, 2));
    }

    console.error(`\nTotal rows: ${rows.length}`);

    // Print summary
    const summary = {};
    for (const row of rows) {
      summary[row.event_name] = (summary[row.event_name] || 0) + 1;
    }
    console.error('\n--- Summary ---');
    for (const [event, count] of Object.entries(summary)) {
      console.error(`${event}: ${count}`);
    }

  } catch (error) {
    console.error('Error fetching data:', error.message);

    if (error.message.includes('Not found: Table')) {
      console.error('\nThe events table was not found. This could mean:');
      console.error('1. BigQuery export is not enabled in GA4');
      console.error('2. The dataset ID is incorrect');
      console.error('3. No data has been exported yet (wait 24-48 hours after enabling)');
      console.error(`\nLooking for: ${PROJECT_ID}.${DATASET_ID}.events_*`);
    }

    if (error.message.includes('Permission')) {
      console.error('\nMake sure the service account has BigQuery Data Viewer role.');
    }

    process.exit(1);
  }
}

extractTelemetry();
