const fs = require('fs');
const path = require('path');

// 1. Resolve file paths (supports both local and GHA root directory structures)
function resolvePaths() {
    const cwd = process.cwd();
    
    let raidsPath = path.join(cwd, 'events', 'raids.json');
    let trackerPath = path.join(cwd, 'events', 'tracker.json');
    
    if (!fs.existsSync(raidsPath)) {
        raidsPath = path.join(cwd, 'raids.json');
    }
    if (!fs.existsSync(trackerPath)) {
        trackerPath = path.join(cwd, 'tracker.json');
    }
    
    return { raidsPath, trackerPath };
}

// 2. Main Execution
async function main() {
    const { raidsPath, trackerPath } = resolvePaths();
    
    if (!fs.existsSync(raidsPath)) {
        console.error(`Error: raids.json not found at expected paths.`);
        process.exit(1);
    }
    if (!fs.existsSync(trackerPath)) {
        console.error(`Error: tracker.json not found at expected paths.`);
        process.exit(1);
    }

    // Load credentials
    const appId = process.env.ONESIGNAL_APP_ID;
    const restKey = process.env.ONESIGNAL_REST_API_KEY;
    const baseUrl = process.env.PLATFORM_BASE_URL || 'https://ou1ts.github.io/events/';

    if (!appId || !restKey) {
        console.error('Error: ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY environment variables must be set.');
        process.exit(1);
    }

    // Read files
    const raids = JSON.parse(fs.readFileSync(raidsPath, 'utf8'));
    const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));

    // Check command line options or event name
    const isDeadlineCheck = process.argv.includes('--deadline-check') || process.env.GITHUB_EVENT_NAME === 'schedule';

    if (isDeadlineCheck) {
        console.log('Running in Deadline Scan Mode...');
        await runDeadlineScan(raids, tracker, trackerPath, appId, restKey, baseUrl);
    } else {
        console.log('Running in New Raid Dispatch Mode...');
        await runNewRaidDispatch(raids, tracker, trackerPath, appId, restKey, baseUrl);
    }
}

// 3. New Raid Dispatch Mode
async function runNewRaidDispatch(raids, tracker, trackerPath, appId, restKey, baseUrl) {
    if (raids.length === 0) {
        console.log('No raids found inside raids.json.');
        return;
    }

    // Isolate the single most recent entry (index 0 since sorted descending by Raid_Num)
    const newRaid = raids[0];
    console.log(`Analyzing most recent raid: Raid #${newRaid.Raid_Num} - "${newRaid.title}"`);

    // Verify if this raid has already been dispatched to prevent redundant notifications
    const targetUrl = `${baseUrl.replace(/\/$/, '')}/#raid-${newRaid.Raid_Num}`;
    const title = `New Raid Active: ${newRaid.title}`;
    const body = `Venue: ${newRaid.venue} | ${newRaid.dateRange || ''}`;

    let sent = false;
    try {
        await sendOneSignalPush(appId, restKey, title, body, targetUrl);
        sent = true;
    } catch (e) {
        console.error('Failed to send OneSignal push:', e);
        process.exit(1);
    }

    if (sent) {
        // Sync tracker configuration parameters
        tracker.lastUpdated = new Date().toISOString();
        syncTrackerReminders(raids, tracker);
        fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2) + '\n', 'utf8');
        console.log('tracker.json updated and saved successfully.');
    }
}

// 4. Deadline Scan Mode
async function runDeadlineScan(raids, tracker, trackerPath, appId, restKey, baseUrl) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sync active reminders first to ensure we have the newest list
    syncTrackerReminders(raids, tracker);

    let trackerUpdated = false;

    for (const reminder of tracker.activeReminders) {
        if (reminder.reminderSent) continue;

        // Parse YYYY-MM-DD to local midnight
        const parts = reminder.regEndDate.split('-');
        if (parts.length !== 3) continue;

        const regDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        regDate.setHours(0, 0, 0, 0);

        const diffTime = regDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // If today is exactly 1 day prior to the registration end date
        if (diffDays === 1) {
            const raid = raids.find(r => r.Raid_Num === reminder.raidNum);
            if (!raid) {
                console.warn(`Warning: Raid #${reminder.raidNum} not found in raids.json, skipping.`);
                continue;
            }

            console.log(`Raid #${reminder.raidNum} registration closes tomorrow! Sending notification...`);
            const targetUrl = `${baseUrl.replace(/\/$/, '')}/#raid-${reminder.raidNum}`;
            const title = `Raid Deadline Tomorrow!`;
            const body = `Registration for "${raid.title}" closes tomorrow. Don't miss out!`;

            try {
                await sendOneSignalPush(appId, restKey, title, body, targetUrl);
                reminder.reminderSent = true;
                trackerUpdated = true;
            } catch (e) {
                console.error(`Failed to send deadline notification for Raid #${reminder.raidNum}:`, e);
            }
        }
    }

    if (trackerUpdated) {
        tracker.lastUpdated = new Date().toISOString();
        fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2) + '\n', 'utf8');
        console.log('tracker.json updated with sent deadlines.');
    } else {
        console.log('No registration deadlines matching exactly 1 day prior were found.');
    }
}

// 5. Sync active reminders list
function syncTrackerReminders(raids, tracker) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentRemindersMap = {};
    if (tracker.activeReminders && Array.isArray(tracker.activeReminders)) {
        tracker.activeReminders.forEach(r => {
            currentRemindersMap[r.raidNum] = r.reminderSent;
        });
    }

    const updatedReminders = [];
    raids.forEach(raid => {
        if (!raid.RegEndDate || !raid.Raid_Num) return;

        // Parse YYYY-MM-DD
        const parts = raid.RegEndDate.split('-');
        if (parts.length !== 3) return;
        const regDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        regDate.setHours(0, 0, 0, 0);

        // Include if registration is today or in the future
        if (regDate >= today) {
            const alreadySent = currentRemindersMap[raid.Raid_Num] || false;
            updatedReminders.push({
                raidNum: raid.Raid_Num,
                regEndDate: raid.RegEndDate,
                reminderSent: alreadySent
            });
        }
    });

    // Sort by raid number ascending
    updatedReminders.sort((a, b) => a.raidNum - b.raidNum);
    
    tracker.activeReminders = updatedReminders;
    tracker.eventsCount = raids.length;
}

// 6. Helper: Send OneSignal Push Notification via REST API
async function sendOneSignalPush(appId, restKey, title, body, url) {
    const payload = {
        app_id: appId,
        target_channel: "push",
        included_segments: ["Subscribed Users"],
        headings: { en: title },
        contents: { en: body },
        url: url
    };

    console.log(`Dispatching push notification: "${title}"`);
    
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Basic ${restKey}`
        },
        body: JSON.stringify(payload)
    });

    const resJson = await response.json();
    if (!response.ok) {
        throw new Error(`OneSignal REST API returned HTTP ${response.status}: ${JSON.stringify(resJson)}`);
    }

    return resJson;
}

// Start Script
main().catch(err => {
    console.error('Fatal Script Error:', err);
    process.exit(1);
});
