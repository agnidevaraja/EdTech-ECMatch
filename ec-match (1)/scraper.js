/**
 * EC Match — Hybrid Standalone Server-Side Scraper
 *
 * Discovers high-school extracurricular opportunities (internships, research
 * programs, competitions, fellowships, volunteer roles) with upcoming
 * 2026/2027 deadlines and upserts them into Firestore under the
 * `extracurriculars` collection.
 *
 * Hybrid approach:
 *   1. Fetch HTML from public, structured program directories
 *      (pathwaystoscience.org, cur.org, devpost.com/hackathons,
 *       volunteermatch.org) via native Node `fetch` + cheerio — no browser,
 *      no CORS issues.
 *   2. Use Groq (`new Groq({})` with GROQ_API_KEY) with
 *      `openai/gpt-oss-120b` + `browser_search` to run rotating search
 *      queries and extract/structure opportunities into JSON.
 *   3. Deduplicate and upsert into Firestore via firebase-admin
 *      (FIREBASE_SERVICE_ACCOUNT env var or serviceAccountKey.json).
 *
 * Run locally:  node scraper.js
 * CI: .github/workflows/scrape.yml runs this every 24 hours.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { Groq } from 'groq-sdk';
import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import * as admin from 'firebase-admin';

const MODEL = 'openai/gpt-oss-120b';

const DIRECTORIES = [
  {
    name: 'pathwaystoscience.org',
    url: 'https://www.pathwaystoscience.org/programs.aspx',
    focus: 'summer research & STEM programs for high school students',
  },
  {
    name: 'cur.org',
    url: 'https://www.cur.org/',
    focus: 'undergraduate & high school research opportunities',
  },
  {
    name: 'devpost.com/hackathons',
    url: 'https://devpost.com/hackathons',
    focus: 'high school & student hackathons 2026 2027',
  },
  {
    name: 'volunteermatch.org',
    url: 'https://www.volunteermatch.org/',
    focus: 'high school volunteer & internship opportunities',
  },
];

const SEARCH_QUERIES = [
  '"high school" summer research internship program 2027 application deadline',
  '"open to high school students" paid internship OR fellowship 2026 2027',
  'site:.edu "high school students" summer program OR lab internship application',
  'site:.gov "high school" internship OR apprenticeship STEM 2027',
  'high school student competition 2027 application deadline STEM',
  '"high school" research fellowship summer 2027 deadline',
];

const REQUEST_DELAY_MS = 2500;
const BATCH_SIZE = 450;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugId(title, url) {
  const base = normalize(title).slice(0, 40).replace(/\s+$/, '') || 'opportunity';
  const tail = Buffer.from(url || title).toString('base64url').slice(-6);
  return `${base}-${tail}`.replace(/[^a-z0-9_-]/g, '-');
}

function emptyBreakdown() {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
}

function defaultOpportunity() {
  return {
    id: '',
    title: '',
    description: '',
    type: 'Program',
    subject: 'STEM',
    topic: '',
    format: 'Online',
    cost: 'Free',
    effortLevel: 'Medium',
    deadline: '',
    materials: [],
    url: '',
    isVerified: false,
    prestigeRating: 3,
    ageGroup: '14-18',
    location: '',
    rationale: '',
    source: 'hybrid-scraper',
    scrapedAt: new Date().toISOString(),
    overallRating: 0,
    reviewCount: 0,
    ratingBreakdown: emptyBreakdown(),
    avgOverallExperience: 0,
    avgCompetitivenessPrestige: 0,
    avgTimeCommitment: 0,
    avgMentorshipSupport: 0,
    avgCollegeAppImpact: 0,
  };
}

function isValidOpportunity(o) {
  return (
    o &&
    typeof o.title === 'string' &&
    o.title.trim().length >= 3 &&
    typeof o.url === 'string' &&
    o.url.trim().length > 0 &&
    /^https?:\/\//i.test(o.url)
  );
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch (e) {
    return null;
  }
}

function looksLikeProgram(text, href) {
  const t = (text || '').trim();
  if (!t || t.length < 4 || t.length > 160) return false;
  const lower = t.toLowerCase();
  const skip = ['home', 'about', 'contact', 'privacy', 'terms', 'login', 'sign up', 'search', 'menu', 'footer', 'header'];
  if (skip.includes(lower)) return false;
  const h = (href || '').toLowerCase();
  const programHint = /program|intern|research|hackathon|competition|fellowship|volunteer|opportunity|summer|stem|high school|student/i;
  return programHint.test(t) || programHint.test(h);
}

async function fetchDirectoryText(directory) {
  console.log(`📂 Fetching directory: ${directory.name} (${directory.url})`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(directory.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ECMatch-Scraper/1.0; +https://ecmatch.example)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`⚠️  ${directory.name} returned ${res.status}; skipping.`);
      return { candidates: [], pageText: '' };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header').remove();

    const candidates = [];
    const seenUrls = new Set();
    $('a[href]').each((_i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (!looksLikeProgram(text, href)) return;
      const url = resolveUrl(directory.url, href);
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      candidates.push({
        title: text,
        url,
        source: directory.name,
        snippet: $(el).closest('article, .card, .listing, li, div').text().trim().slice(0, 300) || text,
      });
    });

    const pageText = $('main, article, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    console.log(`✅ ${directory.name}: ${candidates.length} candidate links found.`);
    return { candidates, pageText };
  } catch (error) {
    console.error(`❌ Failed to fetch ${directory.name}: ${error.message}`);
    return { candidates: [], pageText: '' };
  }
}

let groq;
function getGroq() {
  if (!groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set. Add it to .env.local or your environment.');
    }
    groq = new Groq({ apiKey });
  }
  return groq;
}

async function extractWithGroq(contextLabel, contextText) {
  const prompt = `
You are a meticulous research assistant. Extract extracurricular opportunities for HIGH SCHOOL students
from the context below. Each opportunity must have an upcoming 2026 or 2027 application deadline
(or be open/rolling with no hard deadline) and be genuinely open to high school students.

Context source: ${contextLabel}
Context text:
"""
${contextText}
"""

Instructions:
- Return ONLY a valid JSON object (no markdown fences, no prose). The object must have a single key
  "opportunities" whose value is a JSON array.
- Each array element must match this schema exactly:
  {
    "title": string,
    "description": string,
    "type": string,
    "subject": string,
    "topic": string,
    "format": "Online" | "In-person" | "Hybrid",
    "cost": string,
    "effortLevel": "Low" | "Medium" | "High",
    "deadline": string,
    "materials": string[],
    "url": string,
    "isVerified": false,
    "prestigeRating": number,
    "ageGroup": string,
    "location": string,
    "rationale": string
  }
- Only include opportunities clearly open to high school students.
- Deduplicate within this call (no identical titles/URLs).
- If nothing valid is found, return { "opportunities": [] }.
`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
    const text = completion.choices[0]?.message?.content || '';
    return parseJsonObjectArray(text);
  } catch (error) {
    console.error(`❌ Groq extraction failed for "${contextLabel}": ${error.message}`);
    return [];
  }
}

async function groqSearchQuery(query) {
  console.log(`🔍 Groq live search query: "${query}"`);
  const prompt = `
Use browser search to find real extracurricular opportunities for HIGH SCHOOL students with upcoming 2026/2027
deadlines matching this query: "${query}"

Target types: internships, research programs, competitions, fellowships, hackathons, volunteer roles.

Return ONLY a valid JSON object (no markdown fences, no extra prose). The object must have a single key
"opportunities" whose value is a JSON array.
- Each array element must match this schema exactly:
  {
    "title": string,
    "description": string,
    "type": string,
    "subject": string,
    "topic": string,
    "format": "Online" | "In-person" | "Hybrid",
    "cost": string,
    "effortLevel": "Low" | "Medium" | "High",
    "deadline": string,
    "materials": string[],
    "url": string,
    "isVerified": false,
    "prestigeRating": number,
    "ageGroup": string,
    "location": string,
    "rationale": string
  }
- Only include real opportunities found via search with valid https:// URLs.
- Only include opportunities clearly open to high school students.
- Deduplicate within this call. Return { "opportunities": [] } if nothing valid is found.
`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'browser_search' }],
      temperature: 0.2,
    });
    const text = completion.choices[0]?.message?.content || '';
    const items = parseJsonObjectArray(text);
    items.forEach((item) => { item.source = 'groq-search'; });
    console.log(`   → ${items.length} opportunities extracted.`);
    return items;
  } catch (error) {
    console.error(`   ❌ Groq search query failed: ${error.message}`);
    return [];
  }
}

function parseJsonObjectArray(text) {
  if (!text) return [];
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    const arr = obj && obj.opportunities;
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const obj = JSON.parse(match[0]);
        return Array.isArray(obj?.opportunities) ? obj.opportunities : [];
      } catch {}
    }
    console.warn('⚠️  Could not parse JSON object from Groq output.');
    return [];
  }
}

function structureOpportunity(raw, fallbackSource) {
  const o = defaultOpportunity();
  o.title = String(raw.title || '').trim();
  o.description = String(raw.description || '').trim();
  o.type = String(raw.type || 'Program').trim();
  o.subject = String(raw.subject || 'STEM').trim();
  o.topic = String(raw.topic || '').trim();
  o.format = ['Online', 'In-person', 'Hybrid'].includes(raw.format) ? raw.format : 'Online';
  o.cost = String(raw.cost || 'Free').trim();
  o.effortLevel = ['Low', 'Medium', 'High'].includes(raw.effortLevel) ? raw.effortLevel : 'Medium';
  o.deadline = String(raw.deadline || '').trim();
  o.url = String(raw.url || '').trim();
  o.isVerified = raw.isVerified === true;
  o.prestigeRating = Number.isFinite(Number(raw.prestigeRating))
    ? Math.min(5, Math.max(1, Math.round(Number(raw.prestigeRating))))
    : 3;
  o.ageGroup = String(raw.ageGroup || '14-18').trim();
  o.location = String(raw.location || '').trim() || 'Online';
  o.rationale = String(raw.rationale || '').trim();
  o.materials = Array.isArray(raw.materials)
    ? raw.materials.map(String).slice(0, 6)
    : [];
  o.source = raw.source || fallbackSource || 'hybrid-scraper';
  o.id = slugId(o.title, o.url);
  return o;
}

async function gatherAllOpportunities() {
  const all = [];
  const seenTitles = new Set();
  const seenUrls = new Set();

  for (const directory of DIRECTORIES) {
    const { candidates, pageText } = await fetchDirectoryText(directory);
    if (pageText) {
      const extracted = await extractWithGroq(`${directory.name} directory page`, pageText);
      for (const raw of extracted) {
        const o = structureOpportunity(raw, directory.name);
        if (!isValidOpportunity(o)) continue;
        if (seenTitles.has(normalize(o.title)) || seenUrls.has(o.url)) continue;
        seenTitles.add(normalize(o.title));
        seenUrls.add(o.url);
        all.push(o);
      }
    }
    for (const cand of candidates) {
      if (seenTitles.has(normalize(cand.title)) || seenUrls.has(cand.url)) continue;
      seenTitles.add(normalize(cand.title));
      seenUrls.add(cand.url);
      all.push(structureOpportunity({ ...cand, description: cand.snippet }, cand.source));
    }
    await sleep(REQUEST_DELAY_MS);
  }

  for (const query of SEARCH_QUERIES) {
    const items = await groqSearchQuery(query);
    for (const raw of items) {
      const o = structureOpportunity(raw, 'groq-search');
      if (!isValidOpportunity(o)) continue;
      if (seenTitles.has(normalize(o.title)) || seenUrls.has(o.url)) continue;
      seenTitles.add(normalize(o.title));
      seenUrls.add(o.url);
      all.push(o);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n🧮 Total unique opportunities gathered: ${all.length}`);
  return all;
}

async function initFirestore() {
  const defaultApp = admin.apps && admin.apps.length > 0 ? admin.apps[0] : null;
  if (defaultApp) return admin.firestore();

  let serviceAccount;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not valid JSON.');
    }
  } else {
    const fs = await import('fs');
    const path = await import('path');
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(keyPath)) {
      throw new Error(
        'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT or add serviceAccountKey.json (gitignored).'
      );
    }
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || serviceAccount.projectId,
  });
  return admin.firestore();
}

async function upsertOpportunities(opportunities) {
  const db = await initFirestore();
  const collection = db.collection('extracurriculars');

  let committed = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const opp of opportunities) {
    const ref = collection.doc(opp.id);
    batch.set(ref, opp, { merge: true });
    opsInBatch++;

    if (opsInBatch >= BATCH_SIZE) {
      await batch.commit();
      committed += opsInBatch;
      console.log(`   💾 Committed ${committed}/${opportunities.length} ...`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
    committed += opsInBatch;
  }

  console.log(`\n✅ Upsert complete: ${committed} opportunities written to 'extracurriculars'.`);
  return committed;
}

async function main() {
  console.log('🚀 EC Match hybrid scraper starting...\n');
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY is not set — Groq extraction will fail.');
  }

  const opportunities = await gatherAllOpportunities();
  if (opportunities.length === 0) {
    console.log('ℹ️  No opportunities gathered. Nothing to upsert.');
    return;
  }

  await upsertOpportunities(opportunities);
  console.log('\n🎉 Scraper finished successfully.');
}

main().catch((error) => {
  console.error('💥 Scraper failed:', error);
  process.exit(1);
});