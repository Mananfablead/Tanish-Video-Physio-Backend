#!/usr/bin/env node

/**
 * Server Health Check Script
 * Run this to diagnose CPU and memory issues
 */

const os = require('os');
const { exec } = require('child_process');

console.log('\n===========================================');
console.log('🏥  SERVER HEALTH CHECK');
console.log('===========================================\n');

// System Information
console.log('📊 SYSTEM INFORMATION');
console.log('-------------------------------------------');
console.log(`Platform: ${os.platform()} ${os.arch()}`);
console.log(`CPU Model: ${os.cpus()[0].model}`);
console.log(`CPU Cores: ${os.cpus().length}`);
console.log(`Total Memory: ${(os.totalmem() / 1024 ** 3).toFixed(2)} GB`);
console.log(`Free Memory: ${(os.freemem() / 1024 ** 3).toFixed(2)} GB`);
console.log(`Memory Usage: ${((1 - os.freemem() / os.totalmem()) * 100).toFixed(2)}%`);
console.log(`Uptime: ${formatUptime(os.uptime())}`);

// CPU Usage
console.log('\n📈 CPU USAGE');
console.log('-------------------------------------------');
const cpus = os.cpus();
cpus.forEach((cpu, index) => {
    const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle;
    const usage = ((1 - cpu.times.idle / total) * 100).toFixed(2);
    console.log(`Core ${index}: ${usage}%`);
});

// PM2 Status
console.log('\n🚀 PM2 STATUS');
console.log('-------------------------------------------');
exec('pm2 list', (error, stdout, stderr) => {
    if (error) {
        console.log('⚠️  PM2 is not running or not installed');
        console.log(`Error: ${error.message}`);
    } else {
        console.log(stdout);
    }

    // Node.js Process Details
    console.log('\n📋 NODE.JS PROCESS DETAILS');
    console.log('-------------------------------------------');
    exec('ps aux | grep node | grep -v grep', (err, output) => {
        if (err) {
            console.log('⚠️  No Node.js processes found');
        } else {
            console.log(output);
        }

        // Memory Check
        console.log('\n💾 MEMORY ANALYSIS');
        console.log('-------------------------------------------');
        exec('free -h', (memError, memOutput) => {
            if (memError) {
                console.log('Could not fetch memory info');
            } else {
                console.log(memOutput);
            }

            // Disk Usage
            console.log('\n💿 DISK USAGE');
            console.log('-------------------------------------------');
            exec('df -h /', (diskError, diskOutput) => {
                if (diskError) {
                    console.log('Could not fetch disk info');
                } else {
                    console.log(diskOutput);
                }

                // Top CPU Consumers
                console.log('\n🔥 TOP 10 CPU CONSUMERS');
                console.log('-------------------------------------------');
                exec('ps aux --sort=-%cpu | head -n 11', (topCpuError, topCpuOutput) => {
                    if (topCpuError) {
                        console.log('Could not fetch top CPU consumers');
                    } else {
                        console.log(topCpuOutput);
                    }

                    // Top Memory Consumers
                    console.log('\n🧠 TOP 10 MEMORY CONSUMERS');
                    console.log('-------------------------------------------');
                    exec('ps aux --sort=-%mem | head -n 11', (topMemError, topMemOutput) => {
                        if (topMemError) {
                            console.log('Could not fetch top memory consumers');
                        } else {
                            console.log(topMemOutput);
                        }

                        console.log('\n===========================================');
                        console.log('✅ HEALTH CHECK COMPLETE');
                        console.log('===========================================\n');
                    });
                });
            });
        });
    });
});

function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    let uptime = '';
    if (days > 0) uptime += `${days}d `;
    if (hours > 0) uptime += `${hours}h `;
    if (minutes > 0) uptime += `${minutes}m`;

    return uptime || 'Less than a minute';
}
