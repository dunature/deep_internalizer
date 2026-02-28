#!/usr/bin/env node
/**
 * Deep Bridge CLI — send content to Bridge Server
 *
 * Usage:
 *   deep-bridge send <file>       Send a file to Bridge for analysis
 *   deep-bridge push              Read from stdin and send
 *   deep-bridge cache <file>      Cache only (no browser open)
 *   deep-bridge status <taskId>   Query task status
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3737';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 120_000;

const [, , command, ...args] = process.argv;

async function main() {
    switch (command) {
        case 'send':
            await sendFile(args[0], false);
            break;
        case 'cache':
            await sendFile(args[0], true);
            break;
        case 'push':
            await pushStdin(false);
            break;
        case 'status':
            await queryStatus(args[0]);
            break;
        default:
            printUsage();
    }
}

function printUsage() {
    console.log(`
Deep Bridge CLI — Send content to Deep Internalizer

Usage:
  deep-bridge send <file>       Analyze file and open in browser
  deep-bridge push              Read from stdin and analyze
  deep-bridge cache <file>      Analyze and cache only (no browser)
  deep-bridge status <taskId>   Query task status

Environment:
  BRIDGE_URL    Bridge Server URL (default: http://localhost:3737)
  FRONTEND_URL  Frontend URL (default: http://localhost:5173)
`);
}

async function sendFile(filePath, cacheOnly) {
    if (!filePath) {
        console.error('Error: file path required');
        process.exit(1);
    }

    let content;
    try {
        content = readFileSync(filePath, 'utf-8');
    } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
    }

    const title = filePath.split('/').pop().replace(/\.\w+$/, '');
    console.log(`📄 Sending "${title}" (${content.length} chars)...`);

    await analyze(content, title, cacheOnly);
}

async function pushStdin(cacheOnly) {
    const chunks = [];
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    const content = chunks.join('');
    if (!content.trim()) {
        console.error('Error: no content received from stdin');
        process.exit(1);
    }
    console.log(`📄 Received ${content.length} chars from stdin...`);
    await analyze(content, 'stdin-import', cacheOnly);
}

async function analyze(content, title, cacheOnly) {
    let res;
    try {
        res = await fetch(`${BRIDGE_URL}/api/content/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title, cacheOnly, source: 'cli' })
        });
    } catch (err) {
        console.error(`❌ Cannot connect to Bridge Server at ${BRIDGE_URL}`);
        console.error(`   Start it with: cd bridge && npm start`);
        process.exit(1);
    }

    const data = await res.json();

    if (data.cacheHit) {
        console.log(`✅ Cache hit! Content already analyzed.`);
        console.log(`   Hash: ${data.contentHash}`);
        if (!cacheOnly) openBrowser(data.contentHash);
        return;
    }

    console.log(`⏳ Task ${data.taskId} queued, waiting for analysis...`);
    const result = await pollTask(data.taskId);

    if (result.status === 'done') {
        console.log(`✅ Analysis complete — ${result.result.chunks.length} chunks`);
        console.log(`   Hash: ${result.contentHash}`);
        if (!cacheOnly) openBrowser(result.contentHash);
    } else {
        console.error(`❌ Task failed: ${result.error}`);
        process.exit(1);
    }
}

async function pollTask(taskId) {
    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT) {
        await sleep(POLL_INTERVAL);
        try {
            const res = await fetch(`${BRIDGE_URL}/api/tasks/${taskId}`);
            const task = await res.json();
            if (task.status === 'done' || task.status === 'error') return task;
            process.stdout.write('.');
        } catch {
            process.stdout.write('x');
        }
    }
    console.error('\n❌ Timeout waiting for analysis');
    process.exit(1);
}

async function queryStatus(taskId) {
    if (!taskId) {
        console.error('Error: taskId required');
        process.exit(1);
    }
    try {
        const res = await fetch(`${BRIDGE_URL}/api/tasks/${taskId}`);
        const task = await res.json();
        console.log(JSON.stringify(task, null, 2));
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

function openBrowser(hash) {
    const url = `${FRONTEND_URL}/?bridgeHash=${hash}`;
    console.log(`🌐 Opening ${url}`);
    try {
        execSync(`open "${url}"`);
    } catch {
        console.log(`   (Could not open browser automatically — visit the URL above)`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
