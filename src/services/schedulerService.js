const cron = require('node-cron');
const { ScheduledMessage, Message } = require('../models');

async function processDueMessages() {
    for (; ;) {
        const job = await ScheduledMessage.findOneAndUpdate(
            { status: 'pending', runAt: { $lte: new Date() } },
            { $set: { status: 'processing' } },
            { sort: { runAt: 1 }, returnDocument: 'after' }
        );
        if (!job) break;

        try {
            await Message.create({ message: job.message, scheduledFor: job.runAt, scheduleId: job._id });
            job.status = 'done';
            job.executedAt = new Date();
        } catch (err) {
            job.status = 'failed';
            job.error = err.message;
        }
        await job.save();
    }
}

exports.startScheduler = () => {
    processDueMessages().catch(console.error); // catch-up after restarts
    return cron.schedule('* * * * *', () => processDueMessages().catch(console.error));
};