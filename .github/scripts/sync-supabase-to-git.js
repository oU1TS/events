/**
 * Two-Way Sync Script: Supabase -> Git (raids.json)
 * Fetches approved proposals from Supabase and merges them into raids.json in canonical key order.
 */

const fs = require('fs');
const path = require('path');

// Determine file paths relative to script location
const repoRoot = path.resolve(__dirname, '..', '..');
const raidsPath = fs.existsSync(path.join(repoRoot, 'raids.json'))
  ? path.join(repoRoot, 'raids.json')
  : path.join(repoRoot, 'events', 'raids.json');

const trackerPath = fs.existsSync(path.join(repoRoot, 'tracker.json'))
  ? path.join(repoRoot, 'tracker.json')
  : path.join(repoRoot, 'events', 'tracker.json');

const supabaseUrl = process.env.SUPABASE_URL || 'https://bennnocwssmcpiqradvc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlbm5ub2N3c3NtY3BpcXJhZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3Mjk0MjAsImV4cCI6MjEwNTMwNTQyMH0.fOi4e7zdQDkPGA94a9__MgN_Q4u57Pj4-fBl4zz56Bc';

const canonicalKeys = [
  'Raid_Num',
  'title',
  'Status',
  'Type',
  'dateRange',
  'startDate',
  'endDate',
  'RegEndDate',
  'venue',
  'fee',
  'details',
  'subEvents',
  'links',
  'OutsideDhaka',
  'IsOnline',
  'city'
];

function normalizeRaidKeyOrder(raid) {
  if (!raid || typeof raid !== 'object') return raid;
  const normalized = {};
  canonicalKeys.forEach(k => {
    if (k in raid) normalized[k] = raid[k];
  });
  Object.keys(raid).forEach(k => {
    if (!(k in normalized)) normalized[k] = raid[k];
  });
  return normalized;
}

async function fetchApprovedSubmissions() {
  const endpoint = `${supabaseUrl}/rest/v1/event_submissions?status=eq.approved&select=*&order=created_at.asc`;
  const res = await fetch(endpoint, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to query Supabase (HTTP ${res.status}): ${text}`);
  }

  return await res.json();
}

async function main() {
  console.log('[Sync DB -> Git] Starting sync from Supabase to raids.json...');
  if (!fs.existsSync(raidsPath)) {
    throw new Error(`raids.json not found at: ${raidsPath}`);
  }

  let localRaids = JSON.parse(fs.readFileSync(raidsPath, 'utf8'));
  let approvedSubmissions = [];

  try {
    approvedSubmissions = await fetchApprovedSubmissions();
    console.log(`[Sync DB -> Git] Retrieved ${approvedSubmissions.length} approved submissions from database.`);
  } catch (err) {
    console.warn(`[Sync DB -> Git] Query failed or no approved submissions available: ${err.message}`);
    return;
  }

  let hasChanges = false;

  approvedSubmissions.forEach(sub => {
    if (!sub || !sub.data) return;
    const raidPayload = sub.data;
    const targetRaidNum = sub.raid_num || raidPayload.Raid_Num;

    if (sub.submission_type === 'update') {
      const idx = localRaids.findIndex(r => r.Raid_Num === targetRaidNum);
      if (idx !== -1) {
        localRaids[idx] = Object.assign({}, localRaids[idx], raidPayload);
        hasChanges = true;
        console.log(`[Sync DB -> Git] Merged update to Raid #${targetRaidNum}`);
      }
    } else {
      // New raid
      const idx = localRaids.findIndex(r => r.Raid_Num === raidPayload.Raid_Num);
      if (idx !== -1) {
        localRaids[idx] = Object.assign({}, localRaids[idx], raidPayload);
      } else {
        localRaids.unshift(raidPayload);
        console.log(`[Sync DB -> Git] Added new Raid #${raidPayload.Raid_Num}: "${raidPayload.title}"`);
      }
      hasChanges = true;
    }
  });

  // Sort descending by Raid_Num
  localRaids.sort((a, b) => (b.Raid_Num || 0) - (a.Raid_Num || 0));

  // Normalize key order
  const normalizedRaids = localRaids.map(normalizeRaidKeyOrder);

  fs.writeFileSync(raidsPath, JSON.stringify(normalizedRaids, null, 2) + '\n', 'utf8');
  console.log(`[Sync DB -> Git] Updated ${raidsPath} with ${normalizedRaids.length} total raids.`);

  // Update tracker.json if present
  if (fs.existsSync(trackerPath)) {
    try {
      const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
      tracker.eventsCount = normalizedRaids.length;
      tracker.lastUpdated = new Date().toISOString();
      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2) + '\n', 'utf8');
      console.log(`[Sync DB -> Git] Updated tracker.json (eventsCount: ${tracker.eventsCount})`);
    } catch (te) {
      console.warn('[Sync DB -> Git] Could not update tracker.json:', te);
    }
  }

  console.log('[Sync DB -> Git] Completed synchronization successfully.');
}

main().catch(err => {
  console.error('[Sync DB -> Git] Fatal error:', err);
  process.exit(1);
});
