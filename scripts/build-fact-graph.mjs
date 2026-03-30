/**
 * Generates fact-graph.json at build time.
 *
 * Scans all issues for shared entities (institutions, laws, monetary figures,
 * people, policies) and builds an adjacency graph of connected issues.
 *
 * Output: public/fact-graph.json
 * {
 *   entities: { [entityId]: { name, type, issues: string[] } },
 *   connections: { [issueId]: [{ id, weight, sharedEntities: string[] }] },
 *   meta: { generatedAt, issueCount, entityCount, connectionCount }
 * }
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Extract ISSUES (same pattern as build-issues-json.mjs) ──
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

// ── Entity extraction patterns ──

// Malaysian institutions and agencies
const INSTITUTIONS = [
  'MACC', 'SPRM', 'PAC', 'AGC', 'BNM', 'EPF', 'KWSP', 'PETRONAS', 'Khazanah',
  'MCMC', 'JAKIM', 'NRD', 'JPJ', 'LHDN', 'DOSM', 'MITI', 'MOSTI', 'KKMM',
  'MOF', 'EPU', 'MOE', 'MOH', 'KBS', 'KPKT', 'EAIC', 'Suhakam', 'EC', 'SPR',
  'Parliament', 'Senate', 'Dewan Rakyat', 'Dewan Negara', 'Cabinet',
  'High Court', 'Federal Court', 'Court of Appeal',
  'Tabung Haji', 'FELDA', 'MARA', 'PNB', 'TH', 'KWAP',
  'Bursa Malaysia', 'SC', 'Securities Commission',
  'Home Ministry', 'Education Ministry', 'Health Ministry', 'Finance Ministry',
  'Attorney General', 'Chief Justice', 'YDPA', 'Agong',
  'PAS', 'DAP', 'UMNO', 'PKR', 'Bersatu', 'Amanah', 'Warisan', 'GPS',
  'Perikatan Nasional', 'Pakatan Harapan', 'Barisan Nasional',
  // Key programmes and bodies
  '1MDB', 'LCS', 'MRT3', 'ECRL', 'HSR', 'JASA',
  'Boustead', 'FGV', 'Sapura', 'Prasarana', 'PLUS',
  'JPA', 'SPA', 'NADMA', 'CIDB', 'SPAN', 'DOE', 'JKR',
  // Geographic
  'Sabah', 'Sarawak', 'Penang', 'Johor', 'Kelantan', 'Terengganu',
  'East Malaysia', 'Borneo',
];

// Legislation and policies
const LEGISLATION = [
  'SOSMA', 'POCA', 'PPPA', 'Sedition Act', 'OSA', 'Official Secrets Act',
  'MACC Act', 'Companies Act', 'Employment Act', 'Industrial Relations Act',
  'Child Act', 'Education Act', 'Immigration Act', 'Penal Code',
  'Federal Constitution', 'Article 10', 'Article 8', 'Article 121', 'Article 153',
  'Section 4', 'Section 6', 'Section 14A', 'Section 16', 'Section 124B',
  'ISA', 'Emergency Ordinance', 'NSC Act', 'National Security Council',
  'Anti-Money Laundering', 'Whistleblower Protection Act',
  'Prevention of Crime Act', 'Printing Presses',
  'Communications and Multimedia Act', 'CMA',
  'Cybersecurity Act', 'Personal Data Protection',
];

// Stopwords — entities too common to be meaningful connections
const STOPWORDS = new Set([
  'Malaysia', 'Malaysian', 'Government', 'Kuala Lumpur', 'Parliament',
  'PM', 'Prime Minister', 'Federal', 'State', 'Ministry',
]);

// ── Extract entities from text ──
function extractEntities(text) {
  if (!text) return new Set();
  const found = new Set();

  // Institutions
  for (const inst of INSTITUTIONS) {
    // Word-boundary match to avoid partial matches
    const re = new RegExp(`\\b${inst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) {
      if (!STOPWORDS.has(inst)) found.add(`inst:${inst}`);
    }
  }

  // Legislation
  for (const law of LEGISLATION) {
    const re = new RegExp(`\\b${law.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) {
      found.add(`law:${law}`);
    }
  }

  // Monetary figures: RM followed by number + B/billion/M/million
  const moneyRe = /RM\s?([\d,.]+)\s?(billion|B|million|M)\b/gi;
  let m;
  while ((m = moneyRe.exec(text)) !== null) {
    // Normalize to "RMXb" or "RMXm"
    const num = m[1].replace(/,/g, '');
    const unit = m[2].toLowerCase().startsWith('b') ? 'B' : 'M';
    found.add(`money:RM${num}${unit}`);
  }

  // Percentage claims: N% followed by keyword
  const pctRe = /(\d+(?:\.\d+)?)\s?%\s+(Opinion Shift|of\s+\w+|increase|decrease|drop|rise|gap|completion|built|spent|compliance)/gi;
  while ((m = pctRe.exec(text)) !== null) {
    // Too common to be useful as connections — skip
  }

  return found;
}

// ── Extract all entities for an issue ──
function extractIssueEntities(issue) {
  const allText = [
    issue.headline,
    issue.context,
    ...issue.cards.map(c => `${c.big} ${c.sub || ''}`),
  ].join(' ');

  const entities = extractEntities(allText);

  // Lenses excluded from entity extraction — they create overly broad connections.
  // Lens overlap is used as a tiebreaker in weight calculation instead.

  return entities;
}

// ── Build the graph ──
console.log(`  Building fact graph for ${issues.length} issues...`);

// Step 1: Extract entities for every issue
const issueEntities = new Map(); // issueId -> Set<entityId>
const entityIssues = new Map();  // entityId -> Set<issueId>

for (const issue of issues) {
  const entities = extractIssueEntities(issue);
  issueEntities.set(issue.id, entities);

  for (const eid of entities) {
    if (!entityIssues.has(eid)) entityIssues.set(eid, new Set());
    entityIssues.get(eid).add(issue.id);
  }
}

// Step 2: Filter entities — only keep those appearing in 2+ issues but <30% of all issues
// (Entities in 30%+ issues are too generic to be meaningful)
const maxIssueThreshold = Math.floor(issues.length * 0.3);
const meaningfulEntities = new Map();

for (const [eid, issueSet] of entityIssues) {
  if (issueSet.size >= 2 && issueSet.size <= maxIssueThreshold) {
    meaningfulEntities.set(eid, issueSet);
  }
}

// Step 3: Build adjacency list — weighted by shared entity count
const connections = {};
let totalConnections = 0;

for (const issue of issues) {
  const myEntities = issueEntities.get(issue.id);
  const neighborWeights = new Map(); // targetId -> { weight, entities }

  for (const eid of myEntities) {
    if (!meaningfulEntities.has(eid)) continue;

    for (const targetId of meaningfulEntities.get(eid)) {
      if (targetId === issue.id) continue;

      if (!neighborWeights.has(targetId)) {
        neighborWeights.set(targetId, { weight: 0, entities: [] });
      }
      const entry = neighborWeights.get(targetId);
      entry.weight++;

      // Parse entity display name
      const displayName = eid.split(':')[1];
      if (!entry.entities.includes(displayName)) {
        entry.entities.push(displayName);
      }
    }
  }

  // Only keep connections with weight >= 2 AND at least 1 non-money entity shared
  // Money-only connections are false positives (coincidental RM amounts)
  const strong = [...neighborWeights.entries()]
    .filter(([, v]) => {
      if (v.weight < 2) return false;
      // Require at least 1 institution or law — not just money amounts
      const hasNonMoney = v.entities.some(e => !e.startsWith('RM'));
      return hasNonMoney;
    })
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 10)
    .map(([id, v]) => ({ id, weight: v.weight, sharedEntities: v.entities }));

  if (strong.length > 0) {
    connections[issue.id] = strong;
    totalConnections += strong.length;
  }
}

// Step 4: Build entity index (for UI display)
const entityIndex = {};
for (const [eid, issueSet] of meaningfulEntities) {
  const [type, name] = eid.split(':');
  entityIndex[eid] = {
    name,
    type, // inst, law, money, lens
    issues: [...issueSet].slice(0, 20), // cap at 20 for file size
    count: issueSet.size,
  };
}

// Step 5: Compute per-issue connection counts for feed summaries
const connectionCounts = {};
for (const [issueId, conns] of Object.entries(connections)) {
  connectionCounts[issueId] = conns.length;
}

// ── Output ──
const graph = {
  connections,
  connectionCounts,
  entities: entityIndex,
  meta: {
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    entityCount: Object.keys(entityIndex).length,
    connectedIssues: Object.keys(connections).length,
    totalEdges: totalConnections,
  },
};

const json = JSON.stringify(graph);
writeFileSync(join(root, 'public', 'fact-graph.json'), json, 'utf8');

const issuesWithConnections = Object.keys(connections).length;
const avgConnections = issuesWithConnections > 0 ? (totalConnections / issuesWithConnections).toFixed(1) : 0;

console.log(`  ✓ fact-graph.json (${Math.round(json.length / 1024)}KB)`);
console.log(`    ${Object.keys(entityIndex).length} entities, ${issuesWithConnections}/${issues.length} issues connected, avg ${avgConnections} connections/issue`);
