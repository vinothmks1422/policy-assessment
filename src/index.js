const cluster = require('cluster');

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} started`);
    cluster.fork();

    cluster.on('exit', (worker, code) => {
        console.log(`Server worker ${worker.process.pid} exited (code ${code}). Restarting...`);
        setTimeout(() => cluster.fork(), 1000); // small delay avoids a tight crash loop
    });
} else {
    require('./server');
}