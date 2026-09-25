const { Worker } = require('worker_threads');
const path = require('path');

exports.runUploadWorker = (filePath) =>
    new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, '../workers/uploadWorker.js'), {
            workerData: { filePath, mongoUri: process.env.MONGO_URI },
        });
        worker.once('message', (msg) => (msg.error ? reject(new Error(msg.error)) : resolve(msg)));
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
        });
    });