const { ScheduledMessage, Message } = require('../models');
const resolveRunAt = require('../utils/resolveRunAt');

exports.scheduleMessage = async (req, res, next) => {
    try {
        const { message, day, time } = req.body;
        if (!message || !day || !time) {
            return res.status(400).json({ message: 'message, day and time are required' });
        }

        let runAt;
        try {
            runAt = resolveRunAt(day, time);
        } catch (e) {
            return res.status(400).json({ message: e.message });
        }

        const doc = await ScheduledMessage.create({ message, day, time, runAt });
        res.status(201).json({ id: doc._id, runAt: doc.runAt, status: doc.status });
    } catch (err) {
        next(err);
    }
};

exports.listMessages = async (req, res, next) => {
    try {
        res.json(await Message.find().sort({ createdAt: -1 }).limit(50).lean());
    } catch (err) {
        next(err);
    }
};