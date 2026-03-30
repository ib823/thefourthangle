/**
 * Generates AI image prompts for each issue.
 * Maps issue headlines/context to symbolic visual concepts,
 * then wraps them in a consistent T4A brand style prompt.
 * Output: public/og/prompts.json — feed to AI image generator.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Parse issues ──
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }
let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

// ── Master style prompt (T4A trademark) ──
const MASTER_STYLE = `Abstract minimalist editorial illustration. Deep dark navy background (#0f0f23). Single symbolic object as the focal point, centered-left in frame. Muted warm color palette: amber highlights, steel blue accents, earth brown tones. Soft photographic grain texture throughout. Subtle dark vignette at edges. Dramatic single-source low-key lighting from upper left, amber-tinted. No text, no words, no letters, no logos, no watermarks. No human faces. Clean negative space on the right 60% of the frame. Atmospheric, contemplative, journalistic mood. Slight bird's-eye perspective. Ultra-high quality, 8K detail. Aspect ratio exactly 1.91:1 wide landscape format.`;

// ── Theme-to-visual mapping ──
// Keywords in headline/context → symbolic object description
const THEME_VISUALS = [
  // Money / Budget / Finance
  { keywords: ['rm', 'billion', 'budget', 'allocation', 'subsidy', 'tax', 'gst', 'sst', 'debt', 'trillion', 'loan', 'fund', 'ptptn', 'revenue', 'cost', 'spend', 'price', 'wage', 'salary', 'income', 'wealth', 'poverty', 'b40', 'ringgit', 'financial'],
    visuals: [
      'A single folded banknote casting a long dramatic shadow on dark polished surface, amber rim light',
      'A cracked hourglass with golden sand pooling at its base, dark background, warm amber glow',
      'A vintage brass scale with one side empty, tilting dramatically, dark moody background',
      'A single gold coin standing on its edge on a reflective dark surface, about to fall',
      'An old leather wallet with a single receipt emerging, amber spot light, dark atmosphere',
      'A broken piggy bank with a single coin visible inside, dark setting, warm light edge',
    ]},

  // Law / Legal / Courts / Judiciary
  { keywords: ['law', 'legal', 'court', 'judge', 'judicial', 'constitution', 'amendment', 'act', 'legislation', 'parliament', 'statute', 'repeal', 'enforce', 'verdict', 'sentence', 'penalty', 'death penalty', 'sedition', 'defamation'],
    visuals: [
      'A judges wooden gavel half-submerged in dark still water, only the handle visible, amber light',
      'A single brass key lying on an open book with aged pages, dark moody setting',
      'A broken chain link made of bronze resting on dark marble, warm side lighting',
      'An old pocket watch with its face cracked, lying on dark leather, amber tone',
      'A single feather quill standing upright in an ink well, dark background, warm spotlight',
      'A set of antique balance scales with one broken arm, dark atmosphere, warm accents',
    ]},

  // Education / Schools / Universities
  { keywords: ['education', 'school', 'university', 'curriculum', 'student', 'teacher', 'academic', 'learning', 'graduate', 'ranking', 'campus'],
    visuals: [
      'A single open book with pages folded into origami, dark background, warm amber light from left',
      'A lone desk lamp illuminating a blank notebook, everything else in deep shadow',
      'A vintage microscope with amber light passing through its lens, dark setting',
      'A stack of books with the top one open and pages curling, moody dark background',
      'A single pencil standing perfectly balanced on its point, dark surface, warm spotlight',
    ]},

  // Health / Medical / Hospital / Disease
  { keywords: ['health', 'hospital', 'medical', 'disease', 'patient', 'doctor', 'psychiatr', 'mental', 'opioid', 'drug', 'vaccine', 'surveillance', 'zoonotic', 'virus', 'pandemic', 'mortality', 'elderly', 'disability'],
    visuals: [
      'A single stethoscope coiled on dark surface, its metal parts catching amber light',
      'A glass laboratory flask with a single amber drop about to fall, dark background',
      'A medical heartbeat line etched in light on dark glass, warm amber pulse peak',
      'A single white pill capsule half-open with amber powder inside, dark moody setting',
      'An hourglass with red sand running out, medical thermometer nearby, dark atmosphere',
    ]},

  // Environment / Climate / Flood / Water / Sea
  { keywords: ['flood', 'water', 'river', 'sea', 'climate', 'environment', 'forest', 'deforestation', 'reclamation', 'coastal', 'pollution', 'emission', 'wildlife', 'palm oil', 'fishing', 'marine'],
    visuals: [
      'A single tree growing from a crack in dry earth, dark sky, amber dawn light on horizon',
      'A glass jar half-filled with murky water, dark background, warm amber rim light',
      'A compass needle pointing downward toward dark water surface, moody lighting',
      'A single leaf floating on dark still water with concentric ripples, amber highlight',
      'A small paper boat on vast dark water, a single amber light in the distance',
      'A dried coral branch on dark sand, warm amber light casting long shadows',
    ]},

  // Governance / GLC / Corruption / Accountability / Reform
  { keywords: ['glc', 'governance', 'corruption', 'accountability', 'reform', 'transparency', 'audit', 'procurement', 'contract', 'tender', 'privatiz', 'conflict of interest', 'revolving door', 'board', 'appointment'],
    visuals: [
      'A single chess piece (king) with its crown slightly askew, dark polished surface, amber light',
      'A rubber stamp hovering above a blank document, dark atmosphere, warm spotlight',
      'A magnifying glass lying on dark surface casting a circle of amber light below',
      'A single door slightly ajar with amber light seeping through the crack, dark room',
      'A stack of manila folders with one pulled halfway out, dark setting, warm edge light',
    ]},

  // Rights / Freedom / Democracy / Election
  { keywords: ['rights', 'freedom', 'democracy', 'election', 'voter', 'vote', 'constituency', 'campaign', 'political', 'opposition', 'protest', 'speech', 'media', 'press', 'censorship', 'printing'],
    visuals: [
      'A single microphone on a stand in an empty dark room, amber spotlight from above',
      'A ballot box with a single folded paper emerging from the slot, dark background',
      'A birdcage with the door open, a single feather on the floor, dark atmosphere, warm light',
      'A vintage typewriter with a single sheet of paper, amber desk lamp glow, dark surrounds',
      'A pair of hands in silhouette reaching toward amber light through darkness',
    ]},

  // Infrastructure / Transport / Urban / Housing
  { keywords: ['infrastructure', 'rail', 'highway', 'toll', 'transport', 'mrt', 'lrt', 'broadband', 'housing', 'property', 'urban', 'construction', 'bridge', 'road', 'port', 'airport', 'ship'],
    visuals: [
      'A single railway switch lever on rusted tracks, dark moody sky, amber industrial light',
      'A miniature house model with one wall missing, dark background, warm interior glow',
      'An old brass door handle on a weathered dark wooden door, amber side light',
      'A tangled ball of copper wire on dark surface, warm light reflecting off strands',
      'A single traffic signal showing amber, surrounded by complete darkness',
    ]},

  // Race / Religion / Royalty / Identity / Indigenous
  { keywords: ['race', 'ethnic', 'malay', 'chinese', 'indian', 'orang asli', 'indigenous', 'bumiputera', 'halal', 'religion', 'islam', 'mosque', 'temple', 'church', 'syariah', 'royal', 'sultan', 'stateless', 'citizen', 'immigrant', 'refugee', 'foreign worker', 'child marriage'],
    visuals: [
      'A single woven textile with fraying edges on dark surface, amber light on the threads',
      'Multiple clay vessels of different sizes arranged in shadow, one catching amber light',
      'A single flame from an oil lamp reflected in dark glass, warm intimate atmosphere',
      'A hand-woven basket half in shadow, half in warm light, dark background',
      'A cracked mosaic tile pattern with amber light filling the cracks, dark setting',
      'A single seed germinating through dark soil, amber light from above',
    ]},

  // Technology / Cyber / Digital / Data
  { keywords: ['technology', 'digital', 'cyber', 'data', 'online', 'internet', 'ai', 'algorithm', 'software', 'platform', 'social media', 'surveillance'],
    visuals: [
      'A single circuit board with amber traces glowing on dark background, macro detail',
      'A vintage radio dial with amber illumination, dark moody setting',
      'A fiber optic strand with amber light at its tip, dark surroundings',
      'A dark screen reflecting a single point of amber light, atmospheric',
    ]},

  // Regional / East Malaysia / Sabah / Sarawak / States
  { keywords: ['sabah', 'sarawak', 'east malaysia', 'kelantan', 'terengganu', 'penang', 'johor', 'melaka', 'perak', 'pahang', 'selangor', 'kedah', 'perlis', 'negeri sembilan', 'putrajaya', 'labuan'],
    visuals: [
      'A weathered wooden compass lying on an old map, dark background, amber candlelight',
      'A single traditional wooden boat (sampan) on dark calm water, amber horizon glow',
      'A piece of driftwood on dark sand with amber sunset light, minimalist landscape',
      'A vintage telescope pointing toward dark sky with single amber star, dark atmosphere',
    ]},
];

// Fallback for issues that don't match specific themes
const FALLBACK_VISUALS = [
  'A single magnifying glass casting an amber light circle on dark surface, journalistic mood',
  'A vintage compass with its glass cracked, lying on dark leather, warm amber accent',
  'A single lit match in complete darkness, warm glow illuminating smoke wisps',
  'A folded newspaper with a single amber spotlight on dark table, editorial atmosphere',
  'An inkwell with a single drop of amber ink suspended mid-fall, dark background',
  'A brass telescope pointed at an unseen subject, dark setting, warm light on metal',
  'A single candle flame reflected in a dark window, contemplative mood',
  'A sealed wax envelope on dark wood surface, amber seal catching light',
];

// ── Matching logic ──
function findVisualCategory(headline, context) {
  const text = (headline + ' ' + context).toLowerCase();
  const matches = [];

  for (const theme of THEME_VISUALS) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > 0) matches.push({ theme, score });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.length > 0 ? matches[0].theme : null;
}

function pickVisual(theme, issueId) {
  // Deterministic selection based on issue ID hash
  const hash = issueId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const visuals = theme ? theme.visuals : FALLBACK_VISUALS;
  return visuals[hash % visuals.length];
}

// ── Generate prompts ──
const prompts = [];

for (const issue of issues) {
  const theme = findVisualCategory(issue.headline, issue.context);
  const visual = pickVisual(theme, issue.id);

  const fullPrompt = `${MASTER_STYLE}\n\nSubject: ${visual}\n\nThis image represents the concept: "${issue.headline}"`;

  prompts.push({
    id: issue.id,
    headline: issue.headline,
    category: theme ? theme.keywords[0] : 'general',
    subject: visual,
    prompt: fullPrompt,
    filename: `issue-${issue.id}-bg.png`,
  });
}

// ── Output ──
const outDir = join(root, 'public', 'og');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'prompts.json'), JSON.stringify(prompts, null, 2));

console.log(`Generated ${prompts.length} image prompts.`);
console.log(`Output: public/og/prompts.json`);

// Print sample
console.log('\n--- Sample prompts ---');
for (let i = 0; i < 5; i++) {
  const p = prompts[i];
  console.log(`\n[${p.id}] ${p.headline}`);
  console.log(`Category: ${p.category}`);
  console.log(`Subject: ${p.subject}`);
}

// Stats
const categories = {};
for (const p of prompts) {
  categories[p.category] = (categories[p.category] || 0) + 1;
}
console.log('\n--- Category distribution ---');
for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}
