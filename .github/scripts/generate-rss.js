/**
 * UITS Event Raiders - RSS 2.0 Feed Generator
 * Generates feed.xml from raids.json for RSS syndication across platforms
 */

const fs = require('fs');
const path = require('path');

// Locate raids.json (support root or subdirectory execution)
let raidsPath = path.join(__dirname, '../../raids.json');
let outputPath = path.join(__dirname, '../../feed.xml');

if (!fs.existsSync(raidsPath)) {
    raidsPath = path.join(__dirname, '../raids.json');
    outputPath = path.join(__dirname, '../feed.xml');
}

if (!fs.existsSync(raidsPath)) {
    raidsPath = path.resolve('raids.json');
    outputPath = path.resolve('feed.xml');
}

if (!fs.existsSync(raidsPath)) {
    console.error('Error: raids.json not found at:', raidsPath);
    process.exit(1);
}

const raids = JSON.parse(fs.readFileSync(raidsPath, 'utf8'));

const SITE_URL = 'https://ou1ts.github.io/events/';
const FEED_URL = 'https://ou1ts.github.io/events/feed.xml';

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function formatDateToRFC822(dateStr) {
    if (!dateStr) return new Date().toUTCString();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function isPastRaid(raid) {
    if (!raid) return false;
    if (raid.Status === 'Past') return true;
    if (raid.endDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(raid.endDate);
        checkDate.setHours(0, 0, 0, 0);
        if (today > checkDate) {
            return true;
        }
    }
    return false;
}

// Generate items for active / upcoming raids
const activeRaids = raids.filter(r => !isPastRaid(r));

const rssItemsXml = activeRaids.map(raid => {
    const raidUrl = `${SITE_URL}#raid-${raid.Raid_Num}`;
    const pubDate = formatDateToRFC822(raid.startDate || raid.endDate);
    
    // Build subEvents list HTML
    let subEventsHtml = '';
    if (Array.isArray(raid.subEvents) && raid.subEvents.length > 0) {
        subEventsHtml = '<h4>Sub-Events:</h4><ul>' + 
            raid.subEvents.map(se => `<li><strong>${escapeXml(se.title)}:</strong> ${escapeXml(se.details || '')}</li>`).join('') +
            '</ul>';
    }

    // Build links list HTML
    let linksHtml = '';
    if (raid.links && typeof raid.links === 'object') {
        const linkItems = Object.entries(raid.links)
            .filter(([_, url]) => url && url !== '#')
            .map(([label, url]) => `<li><a href="${escapeXml(url)}">${escapeXml(label)}</a></li>`)
            .join('');
        if (linkItems) {
            linksHtml = `<h4>Related Links:</h4><ul>${linkItems}</ul>`;
        }
    }

    const descriptionHtml = `
      <p><strong>Category:</strong> ${escapeXml(raid.Type || 'Event')}</p>
      <p><strong>Date:</strong> ${escapeXml(raid.dateRange || 'TBA')}</p>
      <p><strong>Registration Deadline:</strong> ${escapeXml(raid.RegEndDate || 'TBA')}</p>
      <p><strong>Venue:</strong> ${escapeXml(raid.venue || 'TBA')}</p>
      <p><strong>Fee:</strong> ${escapeXml(raid.fee || 'TBA')}</p>
      <p><strong>Details:</strong> ${escapeXml(raid.details || '')}</p>
      ${subEventsHtml}
      ${linksHtml}
      <p><a href="${raidUrl}">View Full Raid on UITS Event Raiders &rarr;</a></p>
    `.trim();

    return `
    <item>
      <title><![CDATA[[${raid.Type || 'Event'}] ${raid.title}]]></title>
      <link>${raidUrl}</link>
      <guid isPermaLink="false">uits-raid-${raid.Raid_Num}</guid>
      <pubDate>${pubDate}</pubDate>
      <category><![CDATA[${raid.Type || 'Event'}]]></category>
      <description><![CDATA[${descriptionHtml}]]></description>
    </item>`;
}).join('\n');

const lastBuildDate = new Date().toUTCString();

const xmlContent = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>UITS Event Raiders - Active Campaigns</title>
    <link>${SITE_URL}</link>
    <description>Live feed of active tech contests, hackathons, olympiads, and symposiums for UITS students.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${rssItemsXml}
  </channel>
</rss>
`;

fs.writeFileSync(outputPath, xmlContent.trim() + '\n', 'utf8');
console.log(`[RSS Generator] Successfully generated ${outputPath} with ${activeRaids.length} active events.`);
