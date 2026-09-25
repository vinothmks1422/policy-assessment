const fs = require('fs');
const { User, Policy } = require('../models');
const { runUploadWorker } = require('../services/uploadService');

exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Send a .csv or .xlsx file in the "file" field' });
        }
        const summary = await runUploadWorker(req.file.path);
        res.status(201).json({ message: 'Upload completed', summary });
    } catch (err) {
        next(err);
    } finally {
        if (req.file) fs.promises.unlink(req.file.path).catch(() => { });
    }
};

exports.searchByUsername = async (req, res, next) => {
    try {
        const username = (req.query.username || '').trim();
        if (!username) return res.status(400).json({ message: 'username is missing in query param' });

        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const users = await User.find({ firstName: new RegExp(escapeRegex(username), 'i') })
            .select('_id')
            .lean();

        const policies = await Policy.find({ userId: { $in: users.map((u) => u._id) } })
            .populate('userId', 'firstName email phone')
            .populate('categoryId', 'categoryName')
            .populate('companyId', 'companyName')
            .lean();

        res.json({ count: policies.length, data: policies });
    } catch (err) {
        next(err);
    }
};

exports.aggregateByUser = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page));
        const limit = Math.min(parseInt(req.query.limit));

        const data = await Policy.aggregate([
            {
                $group: {
                    _id: '$userId',
                    totalPolicies: { $sum: 1 },
                    policies: {
                        $push: {
                            policyNumber: '$policyNumber',
                            startDate: '$startDate',
                            endDate: '$endDate',
                            categoryId: '$categoryId',
                            companyId: '$companyId',
                        },
                    },
                },
            },
            { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    userName: '$user.firstName',
                    email: '$user.email',
                    totalPolicies: 1,
                    policies: 1,
                },
            },
            { $sort: { userName: 1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
        ]);

        res.json({ page, limit, count: data.length, data });
    } catch (err) {
        next(err);
    }
};