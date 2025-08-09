#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptsDir = __dirname;

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(scriptsDir, file)], { stdio: 'inherit' });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`)) );
  });
}

const main = async () => {
  await run('fetch-medium.mjs');
  await run('fetch-github.mjs');
};

main().catch((err) => { console.error(err); process.exitCode = 1; });