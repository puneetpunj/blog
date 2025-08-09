#!/usr/bin/env node
/**
 * Fetch Medium posts for username from `portfolio/config.json` and write to `data/medium.json`.
 * Uses public endpoints:
 * 1) https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@USERNAME
 * 2) Fallback: parse minimal fields from RSS directly
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const configPath = path.join(root, 'config.json');
const dataDir = path.join(root, 'data');
const outPath = path.join(dataDir, 'medium.json');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function readConfig() {
  const raw = await fs.promises.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${res.status} ${res.statusText}`);
  return res.text();
}

function minimalRssParse(rssText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(rssText))) {
    const itemXml = match[1];
    const get = (tag) => {
      const m = new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`).exec(itemXml);
      return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    };
    items.push({
      title: get('title'),
      link: get('link'),
      description: get('description'),
      pubDate: get('pubDate') || get('updated') || '',
      thumbnail: ''
    });
  }
  return items;
}

async function main() {
  const cfg = await readConfig();
  const mediumField = cfg?.social?.medium;
  if (!mediumField) {
    console.error('No Medium username or URL found in config.social.medium');
    await ensureDir(dataDir);
    await fs.promises.writeFile(outPath, '[]', 'utf8');
    return;
  }

  let feedBase;
  if (/^https?:\/\//i.test(mediumField)) {
    // If it's a full URL, convert to its feed URL
    try {
      const u = new URL(mediumField);
      // If path already contains /feed, keep it; else append /feed
      if (!u.pathname.includes('/feed')) {
        u.pathname = u.pathname.replace(/\/?$/, '/feed');
      }
      feedBase = u.toString();
    } catch {
      // Fallback to username behavior below
    }
  }

  if (!feedBase) {
    const username = String(mediumField).replace(/^@/, '').trim();
    feedBase = `https://medium.com/feed/@${encodeURIComponent(username)}`;
  }

  const rssUrl = feedBase;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

  let posts = [];
  try {
    const data = await fetchJson(apiUrl);
    if (Array.isArray(data.items)) {
      posts = data.items.map((it) => ({
        title: it.title,
        link: it.link,
        description: it.description?.replace(/<[^>]*>/g, '').slice(0, 300) || '',
        pubDate: it.pubDate || it.pub_date,
        thumbnail: it.thumbnail || (it.enclosure && it.enclosure.link) || ''
      }));
    }
  } catch (_) {
    console.warn('rss2json failed, falling back to RSS');
    try {
      const rss = await fetchText(rssUrl);
      posts = minimalRssParse(rss);
    } catch (err) {
      console.error('RSS fallback failed:', err.message);
    }
  }

  await ensureDir(dataDir);
  await fs.promises.writeFile(outPath, JSON.stringify(posts, null, 2), 'utf8');
  console.log(`Wrote ${posts.length} posts to ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});