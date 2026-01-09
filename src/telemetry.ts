import type { TelemetryLevel, TelemetryEvent } from '../types';

// GA4 Configuration - injected at build time via environment variables
const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || '';
const GA4_API_SECRET = import.meta.env.VITE_GA4_API_SECRET || '';
const GA4_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

// Storage keys
const TELEMETRY_LEVEL_KEY = 'telemetry_level';
const TELEMETRY_CLIENT_ID_KEY = 'telemetry_client_id';

// Generate a random client ID for GA4
function generateClientId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get or create client ID
async function getClientId(): Promise<string> {
  const result = await chrome.storage.local.get(TELEMETRY_CLIENT_ID_KEY);
  if (result[TELEMETRY_CLIENT_ID_KEY]) {
    return result[TELEMETRY_CLIENT_ID_KEY];
  }
  const clientId = generateClientId();
  await chrome.storage.local.set({ [TELEMETRY_CLIENT_ID_KEY]: clientId });
  return clientId;
}

// Get current telemetry level
export async function getTelemetryLevel(): Promise<TelemetryLevel> {
  const result = await chrome.storage.local.get(TELEMETRY_LEVEL_KEY);
  return result[TELEMETRY_LEVEL_KEY] || 'off';
}

// Set telemetry level
export async function setTelemetryLevel(level: TelemetryLevel): Promise<void> {
  await chrome.storage.local.set({ [TELEMETRY_LEVEL_KEY]: level });
}

// Filter event data based on telemetry level
function filterEventForLevel(event: TelemetryEvent, level: TelemetryLevel): Record<string, any> {
  const baseParams: Record<string, any> = {
    event_name: event.event_name,
  };

  if (level === 'off') {
    return {}; // Should not reach here, but safety check
  }

  // Statistics level: domain, success, source_count
  if (level === 'statistics' || level === 'verbose') {
    if (event.domain !== undefined) baseParams.domain = event.domain;
    if (event.success !== undefined) baseParams.success = event.success;
    if (event.source_count !== undefined) baseParams.source_count = event.source_count;
    if (event.verification_status !== undefined) baseParams.verification_status = event.verification_status;
  }

  // Verbose level: everything
  if (level === 'verbose') {
    if (event.full_url !== undefined) baseParams.full_url = event.full_url;
    if (event.claim_text !== undefined) baseParams.claim_text = event.claim_text.substring(0, 500); // Limit size
    if (event.claim_length !== undefined) baseParams.claim_length = event.claim_length;
    if (event.source_urls !== undefined) baseParams.source_urls = event.source_urls.slice(0, 10).join(','); // Limit and join
    if (event.evidence_count !== undefined) baseParams.evidence_count = event.evidence_count;
    if (event.fetch_duration_ms !== undefined) baseParams.fetch_duration_ms = event.fetch_duration_ms;
    if (event.verify_duration_ms !== undefined) baseParams.verify_duration_ms = event.verify_duration_ms;
    if (event.error_message !== undefined) baseParams.error_message = event.error_message.substring(0, 200); // Limit size
  }

  return baseParams;
}

// Send telemetry event to GA4
export async function sendTelemetryEvent(event: TelemetryEvent): Promise<void> {
  try {
    const level = await getTelemetryLevel();
    console.log('[Telemetry] Current level:', level);

    // Don't send if telemetry is off
    if (level === 'off') {
      console.log('[Telemetry] Telemetry is off, skipping');
      return;
    }

    // Check if GA4 is configured
    if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) {
      console.warn('[Telemetry] GA4 not configured. MEASUREMENT_ID:', GA4_MEASUREMENT_ID ? 'set' : 'missing', 'API_SECRET:', GA4_API_SECRET ? 'set' : 'missing');
      return;
    }
    console.log('[Telemetry] GA4 configured, sending event:', event.event_name);

    const clientId = await getClientId();
    const filteredParams = filterEventForLevel(event, level);

    const payload = {
      client_id: clientId,
      timestamp_micros: event.timestamp * 1000,
      events: [
        {
          name: event.event_name,
          params: filteredParams,
        },
      ],
    };

    console.log('[Telemetry] Sending to:', GA4_ENDPOINT);
    console.log('[Telemetry] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(GA4_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[Telemetry] Response status:', response.status);
    if (!response.ok) {
      const text = await response.text();
      console.warn('[Telemetry] Failed to send event:', response.status, text);
    } else {
      console.log('[Telemetry] Event sent successfully');
    }
  } catch (error) {
    // Silently fail - telemetry should not break the extension
    console.warn('[Telemetry] Error sending event:', error);
  }
}

// Helper to extract domain from URL
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}
