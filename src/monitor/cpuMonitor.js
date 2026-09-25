const THRESHOLD = Number(process.env.CPU_THRESHOLD) || 70;
const INTERVAL_MS = Number(process.env.CPU_CHECK_INTERVAL_MS) || 1000;
const STRIKES = Number(process.env.CPU_STRIKES) || 3;

let latest = { cpuPercent: 0, threshold: THRESHOLD, at: null };

function startCpuMonitor(onExceed) {
    let lastUsage = process.cpuUsage();
    let lastTime = process.hrtime.bigint();
    let strikes = 0;

    const timer = setInterval(() => {
        const now = process.hrtime.bigint();
        const usage = process.cpuUsage();

        const elapsedMicros = Number(now - lastTime) / 1000;
        const usedMicros = usage.user - lastUsage.user + (usage.system - lastUsage.system);
        const cpuPercent = (usedMicros / elapsedMicros) * 100;

        lastUsage = usage;
        lastTime = now;
        latest = { cpuPercent: Number(cpuPercent.toFixed(1)), threshold: THRESHOLD, at: new Date() };

        if (process.env.LOG_CPU === 'true') console.log(`CPU: ${latest.cpuPercent}%`);

        strikes = cpuPercent >= THRESHOLD ? strikes + 1 : 0;
        if (strikes >= STRIKES) {
            clearInterval(timer);
            onExceed(cpuPercent);
        }
    }, INTERVAL_MS);

    return timer;
}

const getLatestCpu = () => latest;

module.exports = { startCpuMonitor, getLatestCpu, THRESHOLD };