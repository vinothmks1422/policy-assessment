require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const routes = require('./routes');
const { startCpuMonitor, THRESHOLD } = require('./monitor/cpuMonitor');
const { startScheduler } = require('./services/schedulerService');

const app = express();
app.use(express.json());
app.use('/api', routes);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 3000;

connectDB()
    .then(() => {
        const server = app.listen(PORT, () => console.log(`Server on ${PORT} (pid ${process.pid})`));
        startScheduler();

        startCpuMonitor((cpu) => {
            console.warn(`CPU ${cpu.toFixed(1)}% >= ${THRESHOLD}% -> restarting server`);
            setTimeout(() => process.exit(1), 5000).unref(); // force exit if graceful close hangs
            server.close(() => mongoose.disconnect().finally(() => process.exit(1)));
        });
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });