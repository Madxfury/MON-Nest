import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
// Reuse ignored local credentials; never bake a token into config.yaml or Git.
for (const file of ['.env', '../.env.local']) {
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parse(readFileSync(file)))) if (process.env[key] === undefined) process.env[key] = value;
}
const args = process.argv.slice(2);
if (args[0] === 'dev' || args[0] === 'start') await import('./validate-config.mjs');
const child = spawn(process.execPath, ['node_modules/envio/bin.mjs', ...args], { stdio: 'inherit', env: process.env });
child.on('error', () => { console.error('Could not start Envio; install its dependencies in Linux/WSL.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
