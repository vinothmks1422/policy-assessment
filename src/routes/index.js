const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/policyController');

const messageCtrl = require('../controllers/messageController');
const { getLatestCpu } = require('../monitor/cpuMonitor');

const upload = multer({
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
    }),
    fileFilter: (req, file, cb) => {
        const ok = ['.csv', '.xlsx'].includes(path.extname(file.originalname).toLowerCase());
        cb(ok ? null : new Error('Only .csv or .xlsx allowed'), ok);
    },
});

router.post('/upload', upload.single('file'), ctrl.uploadFile);
router.get('/policies/search', ctrl.searchByUsername);
router.get('/policies/aggregate', ctrl.aggregateByUser);

router.post('/messages/schedule', messageCtrl.scheduleMessage);
router.get('/messages', messageCtrl.listMessages);
router.get('/system/cpu', (req, res) => res.json(getLatestCpu()));

// Test helper: burns CPU in small slices so the monitor can keep sampling. Dev only.
if (process.env.NODE_ENV !== 'production') {
    router.get('/system/burn-cpu', (req, res) => {
        const seconds = Math.min(Number(req.query.seconds) || 10, 60);
        const end = Date.now() + seconds * 1000;
        const spin = () => {
            const slice = Date.now() + 50;
            while (Date.now() < slice) { } // busy loop
            if (Date.now() < end) setImmediate(spin);
        };
        res.json({ message: `Burning CPU for ${seconds}s` });
        spin();
    });
}

module.exports = router;