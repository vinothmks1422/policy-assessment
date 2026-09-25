const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const { Agent, User, Account, Lob, Carrier, Policy } = require('../models');

const BATCH = 500;

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toDate = (v) => {
    if (v instanceof Date) return v;
    const s = clean(v);
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
};
const keyOf = (doc, fields) =>
    fields
        .map((f) => (doc[f] instanceof Date ? doc[f].toISOString().slice(0, 10) : String(doc[f] ?? '')))
        .join('|');
const pick = (doc, fields) => Object.fromEntries(fields.map((f) => [f, doc[f] ?? null]));

function readRows(filePath) {
    if (path.extname(filePath).toLowerCase() === '.csv') {
        return parse(fs.readFileSync(filePath), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    }
    const wb = XLSX.readFile(filePath, { cellDates: true });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

// Upserts docs in batches, returns Map(compositeKey -> _id) + counts
async function upsertAndMap(Model, docs, keyFields) {
    const unique = [...new Map(docs.map((d) => [keyOf(d, keyFields), d])).values()];
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < unique.length; i += BATCH) {
        const res = await Model.bulkWrite(
            unique.slice(i, i + BATCH).map((d) => ({
                updateOne: { filter: pick(d, keyFields), update: { $set: d }, upsert: true },
            })),
            { ordered: false }
        );
        inserted += res.upsertedCount;
        updated += res.modifiedCount;
    }

    const firstField = keyFields[0];
    const saved = await Model.find({ [firstField]: { $in: [...new Set(unique.map((d) => d[firstField]))] } }).lean();
    return { ids: new Map(saved.map((s) => [keyOf(s, keyFields), s._id])), inserted, updated };
}

async function run() {
    const { filePath, mongoUri } = workerData;
    await mongoose.connect(mongoUri);

    const rows = readRows(filePath);

    // Normalise every row once
    const parsed = [];
    let skipped = 0;
    for (const r of rows) {
        const user = {
            firstName: clean(r.firstname),
            dob: toDate(r.dob),
            address: clean(r.address),
            phone: clean(r.phone).replace(/\D/g, ''),
            state: clean(r.state),
            zip: clean(r.zip),
            email: clean(r.email).toLowerCase(),
            gender: clean(r.gender),
            userType: clean(r.userType),
        };
        const policyNumber = clean(r.policy_number);
        if (!user.firstName || !policyNumber) { skipped++; continue; }
        parsed.push({
            user,
            agentName: clean(r.agent),
            accountName: clean(r.account_name),
            categoryName: clean(r.category_name),
            companyName: clean(r.company_name),
            policyNumber,
            startDate: toDate(r.policy_start_date),
            endDate: toDate(r.policy_end_date),
        });
    }

    const USER_KEY = ['firstName', 'email', 'dob'];

    const agents = await upsertAndMap(Agent, parsed.filter((p) => p.agentName).map((p) => ({ agentName: p.agentName })), ['agentName']);
    const lobs = await upsertAndMap(Lob, parsed.filter((p) => p.categoryName).map((p) => ({ categoryName: p.categoryName })), ['categoryName']);
    const carriers = await upsertAndMap(Carrier, parsed.filter((p) => p.companyName).map((p) => ({ companyName: p.companyName })), ['companyName']);
    const users = await upsertAndMap(User, parsed.map((p) => p.user), USER_KEY);

    const userIdOf = (p) => users.ids.get(keyOf(p.user, USER_KEY));

    const accounts = await upsertAndMap(
        Account,
        parsed.filter((p) => p.accountName).map((p) => ({ accountName: p.accountName, userId: userIdOf(p) })),
        ['accountName', 'userId']
    );

    const policies = await upsertAndMap(
        Policy,
        parsed.map((p) => ({
            policyNumber: p.policyNumber,
            startDate: p.startDate,
            endDate: p.endDate,
            categoryId: lobs.ids.get(p.categoryName),
            companyId: carriers.ids.get(p.companyName),
            userId: userIdOf(p),
        })),
        ['policyNumber']
    );

    const stat = (x) => ({ inserted: x.inserted, updated: x.updated });
    return {
        totalRows: rows.length,
        skippedRows: skipped,
        collections: {
            agents: stat(agents), lobs: stat(lobs), carriers: stat(carriers),
            users: stat(users), accounts: stat(accounts), policies: stat(policies),
        },
    };
}

run()
    .then((summary) => parentPort.postMessage(summary))
    .catch((err) => parentPort.postMessage({ error: err.message }))
    .finally(() => mongoose.disconnect());