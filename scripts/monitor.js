#!/usr/bin/env node

/**
 * Real-time CPU and Memory Monitor
 * Shows live metrics for Node.js processes
 */

const { exec } = require('child_process');
const os = require('os');

// Configuration
const REFRESH_INTERVAL = 2000; // 2 seconds
const SHOW_TOP_PROCESSES = 5;

// Clear screen and move cursor to top
const clearScreen = () => process.stdout.write('\x1B[2J\x1B[0f');

// Format bytes to human-readable
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Get Node.js process info
const getNodeProcesses = (callback) => {
    exec('ps aux | grep -E "node|npm" | grep -v grep | sort -nrk 3', (error, stdout) => {
        if (error) {
            callback(null);
            return;
        }

        const lines = stdout.trim().split('\n').filter(line => line.trim());
        const processes = lines.map(line => {
            const parts = line.split(/\s+/);
            return {
                user: parts[0],
                pid: parts[1],
                cpu: parseFloat(parts[2]),
                memory: parseFloat(parts[3]),
                vsz: parts[4],
                rss: parts[5],
                command: parts.slice(10).join(' ')
            };
        });

        callback(processes.slice(0, SHOW_TOP_PROCESSES));
    });
};

// Get system stats
const getSystemStats = () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpus = os.cpus();
    let totalIdle = 0;
    let totalUsage = 0;

    cpus.forEach(cpu => {
        const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle;
        const idle = cpu.times.idle;
        totalIdle += idle;
        totalUsage += ((1 - idle / total) * 100);
    });

    const avgCpuUsage = totalUsage / cpus.length;

    return {
        cpuCount: cpus.length,
        cpuUsage: avgCpuUsage.toFixed(2),
        totalMemory: totalMem,
        usedMemory: usedMem,
        freeMemory: freeMem,
        memoryUsage: ((usedMem / totalMem) * 100).toFixed(2)
    };
};

// Display dashboard
const displayDashboard = () => {
    clearScreen();

    const system = getSystemStats();

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       🚀 NODE.JS PERFORMANCE MONITOR                     ║');
    console.log('║       Updated: ' + new Date().toLocaleTimeString() + '                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // System Overview
    console.log('📊 SYSTEM OVERVIEW');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  CPU Cores:      ${system.cpuCount}`);
    console.log(`  CPU Usage:      ${system.cpuUsage}% ${getUsageBar(parseFloat(system.cpuUsage))}`);
    console.log(`  Memory Total:   ${formatBytes(system.totalMemory)}`);
    console.log(`  Memory Used:    ${formatBytes(system.usedMemory)} (${system.memoryUsage}%)`);
    console.log(`  Memory Free:    ${formatBytes(system.freeMemory)}`);
    console.log(`  Memory Usage:   ${getUsageBar(parseFloat(system.memoryUsage))}`);
    console.log('');

    // PM2 Status
    console.log('🚀 PM2 PROCESSES');
    console.log('─────────────────────────────────────────────────────────');
    exec('pm2 list --mini', (error, stdout) => {
        if (error || !stdout) {
            console.log('  ⚠️  PM2 not running or no processes');
        } else {
            console.log(stdout);
        }
    });

    // Node.js Processes
    getNodeProcesses((processes) => {
        if (!processes || processes.length === 0) {
            console.log('  ⚠️  No Node.js processes found');
        } else {
            console.log('📋 TOP NODE.JS PROCESSES (by CPU)');
            console.log('─────────────────────────────────────────────────────────');
            console.log(`  PID      CPU%    MEM%    RSS        Command`);
            console.log('  ─────────────────────────────────────────────────────');

            processes.forEach(proc => {
                const pidStr = proc.pid.padEnd(8);
                const cpuStr = proc.cpu.toFixed(1).padStart(6);
                const memStr = proc.memory.toFixed(1).padStart(6);
                const rssStr = formatBytes(parseInt(proc.rss) * 1024).padEnd(10);
                const cmdShort = proc.command.substring(0, 40);

                console.log(`  ${pidStr} ${cpuStr}%  ${memStr}%  ${rssStr} ${cmdShort}`);
            });
        }

        console.log('');
        console.log('═════════════════════════════════════════════════════════');
        console.log('Press Ctrl+C to exit');
        console.log(`Refresh rate: ${REFRESH_INTERVAL / 1000}s`);
        console.log('═════════════════════════════════════════════════════════');

        setTimeout(displayDashboard, REFRESH_INTERVAL);
    });
};

// Create visual usage bar
const getUsageBar = (percentage) => {
    const bars = 20;
    const filledBars = Math.floor((percentage / 100) * bars);
    const emptyBars = bars - filledBars;

    let bar = '[';
    for (let i = 0; i < filledBars; i++) bar += '█';
    for (let i = 0; i < emptyBars; i++) bar += '░';
    bar += ']';

    // Color coding
    if (percentage > 80) return bar + ' 🔴';
    if (percentage > 60) return bar + ' 🟡';
    return bar + ' 🟢';
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n✨ Monitor stopped.');
    process.exit(0);
});

// Start monitoring
console.log('Starting performance monitor...');
displayDashboard();
