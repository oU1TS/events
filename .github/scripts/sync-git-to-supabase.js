/**
 * Two-Way Sync Script: Git (raids.json) -> Supabase
 * When a commit updates raids.json, this script ensures Supabase event_submissions
 * reflects the committed raids as approved records.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const raidsPath = fs.existsSync(path.join(repoRoot, 'raids.json'))
  ? path.join(repoRoot, 'raids.json')
  : path.join(repoRoot, 'events', 'raids.json');

const supabaseUrl = process.env.SUPABASE_URL || 'https://bennnocwssmcpiqradvc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlbm5ub2N3c3NtY3BpcXJhZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3Mjk0MjAsImV4cCI6MjEwNTMwNTQyMH0.fOi4e7zdQDkPGA94a9__MgN_Q4u57Pj4-fBl4zz56Bc';

async function fetchDbSubmissions() {
  const endpoint = `${supabaseUrl}/rest/v1/event_submissions?select=id,raid_num,status,submission_type`;
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
  console.log('[Sync Git -> DB] Reading local raids.json...');
  if (!fs.existsSync(raidsPath)) {
    throw new Error(`raids.json not found at: ${raidsPath}`);
  }

  const localRaids = JSON.parse(fs.readFileSync(raidsPath, 'utf8'));
  console.log(`[Sync Git -> DB] Found ${localRaids.length} raids in git repository.`);

  let dbSubmissions = [];
  try {
    dbSubmissions = await fetchDbSubmissions();
    console.log(`[Sync Git -> DB] Found ${dbSubmissions.length} existing submissions in database.`);
  } catch (err) {
    console.warn(`[Sync Git -> DB] Could not fetch DB submissions (RLS or missing service key): ${err.message}`);
    return;
  }

  // System bot UUID for git automated sync insertions
  const SYSTEM_BOT_UUID = '00000000-0000-0000-0000-000000000000';

  let syncedCount = 0;
  for (const raid of localRaids) {
    const raidNum = raid.Raid_Num;
    const existing = dbSubmissions.find(s => s.raid_num === raidNum && s.status === 'approved');

    if (!existing) {
      // Upsert record into Supabase as approved
      const payload = {
        user_id: SYSTEM_BOT_UUID,
        user_email: 'git-sync@ou1ts.github.io',
        user_name: 'GitOps Auto-Sync',
        submission_type: 'new',
        raid_num: raidNum,
        data: raid,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewer_email: 'git-sync@ou1ts.github.io'
      };

      try {
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/event_submissions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        });

        if (insertRes.ok) {
          syncedCount++;
          console.log(`[Sync Git -> DB] Seeded Raid #${raidNum}: "${raid.title}" into Supabase.`);
        } else {
          const errText = await insertRes.text();
          console.warn(`[Sync Git -> DB] Could not insert Raid #${raidNum} (HTTP ${insertRes.status}): ${errText}`);
        }
      } catch (ie) {
        console.warn(`[Sync Git -> DB] Network error inserting Raid #${raidNum}:`, ie.message);
      }
    }
  }

  console.log(`[Sync Git -> DB] Finished. Seeded ${syncedCount} new records into Supabase.`);
}

main().catch(err => {
  console.error('[Sync Git -> DB] Fatal error:', err);
  process.exit(1);
});
