const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

module.exports = function resolveRunAt(day, time) {
    const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(time).trim());
    if (!t) throw new Error('time must be in 24-hour HH:mm format, e.g. "18:30"');
    const hh = Number(t[1]);
    const mm = Number(t[2]);
    const d = String(day).trim();
    const now = new Date();
    let runAt;

    const weekdayIdx = WEEKDAYS.indexOf(d.toLowerCase());
    if (weekdayIdx !== -1) {
        runAt = new Date(now);
        runAt.setHours(hh, mm, 0, 0);
        runAt.setDate(runAt.getDate() + ((weekdayIdx - now.getDay() + 7) % 7));
        if (runAt <= now) runAt.setDate(runAt.getDate() + 7); // already passed -> next week
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, mo, dd] = d.split('-').map(Number);
        runAt = new Date(y, mo - 1, dd, hh, mm, 0, 0);
        if (runAt.getMonth() !== mo - 1) throw new Error('Invalid calendar date');
    } else {
        throw new Error('day must be a weekday name (e.g. "Friday") or a date (YYYY-MM-DD)');
    }

    if (runAt <= now) throw new Error('Scheduled date/time must be in the future');
    return runAt;
};