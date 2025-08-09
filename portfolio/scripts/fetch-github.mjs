#!/usr/bin/env node
/**
 * Fetch GitHub repos for the username in `config.json` and write simplified
 * project cards to `data/projects.json`.
 *
 * Optional: set GH_TOKEN env var to increase rate limits and fetch topics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const configPath = path.join(root, 'config.json');
const dataDir = path.join(root, 'data');
const outPath = path.join(dataDir, 'projects.json');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function readConfig() {
  const raw = await fs.promises.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

async function gh(url) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'portfolio-fetch-script'
  };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText}`);
  return res.json();
}

function toProject(repo) {
  return {
    name: repo.name,
    description: repo.description || '',
    tech: (repo.topics && repo.topics.length ? repo.topics : []).slice(0, 6),
    url: repo.homepage || '',
    repo: repo.html_url,
    stars: repo.stargazers_count || 0,
    updatedAt: repo.updated_at
  };
}

async function main() {
  const cfg = await readConfig();
  const url = cfg?.social?.github;
  let username = '';
  if (url && typeof url === 'string') {
    const m = url.match(/github\.com\/(.+?)(?:\/|$)/i);
    username = m ? m[1] : '';
  }
  if (!username) {
    console.error('No GitHub profile URL found in config.social.github');
    await ensureDir(dataDir);
    await fs.promises.writeFile(outPath, '[]', 'utf8');
    return;
  }

  // Fetch up to 100 public repos, sorted by updated
  const repos = await gh(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);

  // Optionally fetch topics per repo if not present (older API omits topics unless requested)
  // Modern API includes topics but if missing, skip extra requests to stay simple.

  // Rank by stargazers then recent update
  const ranked = repos
    .filter(r => !r.fork)
    .map(toProject)
    .sort((a, b) => (b.stars - a.stars) || (new Date(b.updatedAt) - new Date(a.updatedAt)) )
    .slice(0, 12);

  await ensureDir(dataDir);
  await fs.promises.writeFile(outPath, JSON.stringify(ranked, null, 2), 'utf8');
  console.log(`Wrote ${ranked.length} projects to ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});