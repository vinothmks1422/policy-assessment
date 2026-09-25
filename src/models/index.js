const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const Agent = model('Agent', new Schema({
    agentName: { type: String, required: true, unique: true },
}, { timestamps: true }));

const User = model('User', new Schema({
    firstName: { type: String, required: true, index: true },
    dob: Date,
    address: String,
    phone: String,
    state: String,
    zip: String,
    email: String,
    gender: String,
    userType: String,
}, { timestamps: true }));

const Account = model('Account', new Schema({
    accountName: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true }));

const Lob = model('Lob', new Schema({
    categoryName: { type: String, required: true, unique: true },
}, { timestamps: true }));

const Carrier = model('Carrier', new Schema({
    companyName: { type: String, required: true, unique: true },
}, { timestamps: true }));

const Policy = model('Policy', new Schema({
    policyNumber: { type: String, required: true, unique: true },
    startDate: Date,
    endDate: Date,
    categoryId: { type: Schema.Types.ObjectId, ref: 'Lob' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Carrier' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true }));

const ScheduledMessage = model('ScheduledMessage', new Schema({
    message: { type: String, required: true },
    day: String,
    time: String,
    runAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
    executedAt: Date,
    error: String,
}, { timestamps: true }));

const Message = model('Message', new Schema({
    message: { type: String, required: true },
    scheduledFor: Date,
    scheduleId: { type: Schema.Types.ObjectId, ref: 'ScheduledMessage' },
}, { timestamps: true }));

module.exports = { Agent, User, Account, Lob, Carrier, Policy, ScheduledMessage, Message };