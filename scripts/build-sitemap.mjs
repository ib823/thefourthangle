import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const siteUrl = 'https://thefourthangle.pages.dev';
const feedPath = join(process.cwd(), 'public', 'issues-feed.json');
const sitemapPath = join(process.cwd(), 'public', 'sitemap.xml');

const issues = JSON.parse(readFileSync(feedPath, 'utf8'));
const staticRoutes = [
  { loc: '/', lastmod: null, priority: '1.0' },
  { loc: '/about', lastmod: null, priority: '0.7' },
  { loc: '/disclaimer', lastmod: null, priority: '0.4' },
];

const issueRoutes = issues.map((issue) => ({
  loc: `/issue/${issue.id}`,
  lastmod: issue.sourceDate || null,
  priority: '0.8',
}));

const urls = [...staticRoutes, ...issueRoutes]
  .map(({ loc, lastmod, priority }) => {
    const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${siteUrl}${loc}</loc>${lastmodTag}\n    <changefreq>daily</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

writeFileSync(sitemapPath, xml, 'utf8');
console.log(`Sitemap written: ${sitemapPath} (${staticRoutes.length + issueRoutes.length} URLs)`);
