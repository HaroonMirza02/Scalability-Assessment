const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cors = require('cors');

const JWT_SECRET = 'super_secret_scalability_token_key';
const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb://127.0.0.1:27017/scalability_db';

// Ensure necessary directories exist
['logs', 'uploads'].forEach(dir => {
    const p = path.join(__dirname, dir);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
});

// App configuration and database setup
const app = express();

// CORS fix: without this, the file upload/preview/download/delete/clear
// features only ever worked while the frontend happened to be routed
// through Vite's dev-only proxy (npm run dev). Any other setup - a
// production build, the frontend deployed separately, or the backend
// opened on a different host/port - was silently blocked by the browser's
// same-origin policy with no visible error beyond "it doesn't work".
// CLIENT_ORIGIN can be set in production to lock this down to your real
// frontend domain instead of allowing all origins.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || true; // true = reflect request origin (dev-friendly)
app.use(cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition']
}));

app.use(express.json());

// Log write stream
const logFile = path.join(__dirname, 'logs', 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function writeLog(level, message, metadata = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...metadata
    };
    const logStr = JSON.stringify(logEntry) + '\n';
    logStream.write(logStr);
    if (process.env.NODE_ENV !== 'test') {
        console.log(`[${level.toUpperCase()}] ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`);
    }
}

// -------------------------------------------------------------
// METRICS TRACKING
// -------------------------------------------------------------
const requestHistory = [];
let eventLoopLag = 0;
let lastLagCheck = Date.now();

// Event loop lag detector
const lagInterval = setInterval(() => {
    const now = Date.now();
    // Expecting 100ms interval, lag is excess time taken
    eventLoopLag = Math.max(0, now - lastLagCheck - 100);
    lastLagCheck = now;
}, 100);
lagInterval.unref();

// Process CPU tracking
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = process.hrtime();
let cpuPercentage = 0;

setInterval(() => {
    const currentUsage = process.cpuUsage();
    const currentTime = process.hrtime(lastCpuTime);

    const elapTimeMS = (currentTime[0] * 1e9 + currentTime[1]) / 1000000;
    const userMS = (currentUsage.user - lastCpuUsage.user) / 1000;
    const systemMS = (currentUsage.system - lastCpuUsage.system) / 1000;

    // Total CPU usage percentage normalized by CPU count
    const cpuPct = ((userMS + systemMS) / elapTimeMS) * 100;
    cpuPercentage = Math.min(100, Math.max(0, cpuPct)) / os.cpus().length;

    lastCpuUsage = currentUsage;
    lastCpuTime = process.hrtime();
}, 2000).unref();

// Structured logging and response timing middleware
app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;

        const record = {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: durationMs,
            timestamp: Date.now()
        };

        requestHistory.push(record);
        if (requestHistory.length > 5000) {
            requestHistory.shift();
        }

        writeLog('info', `${req.method} ${req.path} -> ${res.statusCode} in ${durationMs.toFixed(2)}ms`, {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
            ip: req.ip
        });
    });
    next();
});

// Mongoose Schemas
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});

const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerName: { type: String, required: true },
    item: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    creditCardNumber: { type: String },
    createdAt: { type: Date, default: Date.now }
});

OrderSchema.index({ userId: 1 }); // DB Indexing fix: speed up filters by userId

// Compile models
const User = mongoose.model('User', UserSchema);
const Order = mongoose.model('Order', OrderSchema);

// Connection state helper
mongoose.connect(MONGO_URI, {
    maxPoolSize: 100 // Connection pooling fix: expanded to 100 to handle higher concurrency
}).then(() => {
    writeLog('info', 'Connected to MongoDB database (maxPoolSize: 100)');

    // Set MongoDB profile level to log queries slower than 50ms
    mongoose.connection.db.command({ profile: 2, slowms: 50 })
        .then(() => writeLog('info', 'Database profiling enabled (slowms = 50ms)'))
        .catch(err => writeLog('error', 'Failed to configure DB profiling', { error: err.message }));
}).catch(err => {
    writeLog('fatal', 'DB Connection failed', { error: err.message });
    process.exit(1);
});

// Authentication middleware
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// signup
app.post('/api/auth/signup', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        writeLog('info', `User signed up: ${username}`);
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        next(err);
    }
});

// login
app.post('/api/auth/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (err) {
        next(err);
    }
});

// CRUD - Create
app.post('/api/orders', authenticate, async (req, res, next) => {
    try {
        const { customerName, item, price, quantity, creditCardNumber } = req.body;
        if (!customerName || !item || !price || !quantity) {
            return res.status(400).json({ error: 'Required fields missing: customerName, item, price, quantity' });
        }

        const newOrder = new Order({
            userId: req.user.id,
            customerName,
            item,
            price,
            quantity,
            creditCardNumber: creditCardNumber || 'Unavailable'
        });
        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (err) {
        next(err);
    }
});

// CRUD - Read paginated list (Read-heavy path)
app.get('/api/orders', authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { userId: req.user.id };

        // We intentionally filter by userId. With no index, this queries all records!
        const count = await Order.countDocuments(filter);
        const orders = await Order.find(filter).skip(skip).limit(limit);

        res.json({
            orders,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            totalOrders: count
        });
    } catch (err) {
        next(err);
    }
});

const reportCache = new Map(); // Simple report cache memory

// CPU & DB aggregates report summary (CPU-heavy endpoint)
app.get('/api/orders/report/summary', authenticate, async (req, res, next) => {
    try {
        const cacheKey = req.user.id;
        const now = Date.now();
        if (reportCache.has(cacheKey)) {
            const cached = reportCache.get(cacheKey);
            if (now - cached.timestamp < 10000) { // 10s caching window
                return res.json({
                    report: cached.data.report,
                    cpuDurationMs: cached.data.cpuDurationMs,
                    processedAt: cached.data.processedAt,
                    cached: true
                });
            }
        }

        // 1. Database-heavy aggregation
        const report = await Order.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            {
                $group: {
                    _id: "$item",
                    totalVolume: { $sum: "$quantity" },
                    averagePrice: { $avg: "$price" },
                    totalRevenue: { $sum: { $multiply: ["$price", "$quantity"] } }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        // 2. Artificially heavy CPU operations (busy loop checking SHA256 hashes of each result element multiple times)
        // This blocks Node's single-threaded event loop. We loop 10,000 times per aggregation element.
        const startCpu = process.hrtime();
        for (let item of report) {
            for (let i = 0; i < 5000; i++) {
                const hash = crypto.createHmac('sha256', JWT_SECRET);
                hash.update(JSON.stringify(item) + i);
                hash.digest('hex');
            }
        }
        const diffCpu = process.hrtime(startCpu);
        const cpuDurationMs = (diffCpu[0] * 1e9 + diffCpu[1]) / 1e6;

        const responsePayload = {
            report,
            cpuDurationMs,
            processedAt: new Date().toISOString()
        };

        // Cache the result
        reportCache.set(cacheKey, {
            data: responsePayload,
            timestamp: now
        });

        res.json(responsePayload);
    } catch (err) {
        next(err);
    }
});

// CRUD - Read single
app.get('/api/orders/:id', authenticate, async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        next(err);
    }
});

// CRUD - Update
app.put('/api/orders/:id', authenticate, async (req, res, next) => {
    try {
        const { customerName, item, price, quantity, creditCardNumber } = req.body;
        const updated = await Order.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { customerName, item, price, quantity, creditCardNumber },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

// CRUD - Delete
app.delete('/api/orders/:id', authenticate, async (req, res, next) => {
    try {
        const deleted = await Order.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// -------------------------------------------------------------
// CHAOS SIMULATION ENDPOINTS
// -------------------------------------------------------------
const leakedMemoryData = [];

// 1. Slow DB Call Simulation
app.get('/api/chaos/slow-db', authenticate, async (req, res, next) => {
    try {
        writeLog('info', 'Chaos: Simulating slow DB query...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const orders = await Order.find({ userId: req.user.id }).limit(5);
        res.json({ message: 'Delayed read success', ordersCount: orders.length });
    } catch (err) {
        next(err);
    }
});

// 2. Downstream API Failure Simulation
app.get('/api/chaos/downstream', authenticate, async (req, res) => {
    writeLog('info', 'Chaos: Downstream API failure simulation triggered');
    const rand = Math.random();
    if (rand < 0.5) {
        return res.status(503).json({ error: 'Service Unavailable', details: 'Downstream payment gateway failed' });
    } else {
        writeLog('info', 'Chaos: Downstream API simulation hanging response...');
        // Hang indefinitely to trigger client socket timeout
    }
});

// 3. CPU Pinning Simulation
app.get('/api/chaos/cpu-pin', authenticate, async (req, res) => {
    writeLog('info', 'Chaos: CPU Pinning loop triggered for 5 seconds');
    const start = Date.now();
    while (Date.now() - start < 5000) {
        // Blocking event loop
    }
    res.json({ message: 'CPU Pinning loop finished after 5000ms' });
});

// 4. Memory Leak Simulation
app.get('/api/chaos/memory-leak', authenticate, (req, res) => {
    writeLog('info', 'Chaos: Memory leak allocation triggered');
    const largeBlock = 'X'.repeat(20 * 1024 * 1024);
    leakedMemoryData.push(largeBlock);

    const memUsage = process.memoryUsage();
    res.json({
        message: 'Leaked 20MB of memory.',
        count: leakedMemoryData.length,
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB'
    });
});

// 5. Network Delay Simulation
app.get('/api/chaos/delay', authenticate, async (req, res) => {
    writeLog('info', 'Chaos: Network delay simulator triggered');
    await new Promise(resolve => setTimeout(resolve, 2000));
    res.json({ message: 'Response delayed by 2000ms' });
});

// File Upload endpoint
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File upload required' });
    }
    res.status(201).json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        size: req.file.size
    });
});

// Serve uploaded files as static assets (download / preview)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: function (res, filePath) {
        // Allow inline preview for images and PDFs; force download for everything else
        const ext = path.extname(filePath).toLowerCase();
        const previewable = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf', '.txt', '.md'];
        if (previewable.includes(ext)) {
            res.setHeader('Content-Disposition', 'inline');
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        }
    }
}));

// List all uploaded files
app.get('/api/files', authenticate, (req, res) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    try {
        const files = fs.readdirSync(uploadsDir)
            .filter(f => !f.startsWith('.'))  // skip hidden files
            .map(filename => {
                const filePath = path.join(uploadsDir, filename);
                const stat = fs.statSync(filePath);
                // The filename format is: timestamp-originalname
                const dashIdx = filename.indexOf('-');
                const originalName = dashIdx !== -1 ? filename.slice(dashIdx + 1) : filename;
                const ext = path.extname(filename).toLowerCase();
                return {
                    filename,
                    originalName,
                    size: stat.size,
                    uploadedAt: stat.birthtime || stat.mtime,
                    ext,
                    url: `/uploads/${encodeURIComponent(filename)}`
                };
            })
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)); // newest first

        res.json({ files, count: files.length });
    } catch (err) {
        res.status(500).json({ error: 'Could not read uploads directory', message: err.message });
    }
});

// Delete an uploaded file
app.delete('/api/files/:filename', authenticate, (req, res) => {
    const filename = req.params.filename;
    // Basic security: prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted successfully', filename });
});

// Force-download an uploaded file (always sends Content-Disposition: attachment)
app.get('/api/files/:filename/download', authenticate, (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    // Extract the original user-facing name (strip the timestamp prefix)
    const dashIdx = filename.indexOf('-');
    const originalName = dashIdx !== -1 ? filename.slice(dashIdx + 1) : filename;
    res.download(filePath, originalName);
});

// Bulk-delete: DELETE /api/files?pattern=heavy_load_image.jpg
// Remove-all:  DELETE /api/files?all=true  -> wipes every stored file
app.delete('/api/files', authenticate, (req, res) => {
    const pattern = req.query.pattern;
    const removeAll = req.query.all === 'true';

    if (!pattern && !removeAll) {
        return res.status(400).json({ error: 'pattern or all=true query param required' });
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    try {
        const all = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));
        const toDelete = removeAll
            ? all
            : all.filter(f => {
                const original = f.indexOf('-') !== -1 ? f.slice(f.indexOf('-') + 1) : f;
                return original === pattern || f === pattern;
            });
        toDelete.forEach(f => fs.unlinkSync(path.join(uploadsDir, f)));
        writeLog('info', removeAll ? 'Remove-all: cleared uploads directory' : `Bulk delete by pattern "${pattern}"`, { deletedCount: toDelete.length });
        res.json({ deleted: toDelete.length, files: toDelete });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// METRICS ENDPOINT
// -------------------------------------------------------------
app.get('/api/metrics', async (req, res) => {
    try {
        // DB Observability
        let dbStatus = { current: 0, available: 0 };
        let slowQueries = [];

        if (mongoose.connection.readyState === 1) {
            const stats = await mongoose.connection.db.command({ serverStatus: 1 });
            dbStatus = {
                current: stats.connections.current,
                available: stats.connections.available,
                totalCreated: stats.connections.totalCreated
            };

            // Query MongoDB profiler system.profile for slow queries
            try {
                slowQueries = await mongoose.connection.db.collection('system.profile')
                    .find({ millis: { $gt: 50 } })
                    .sort({ ts: -1 })
                    .limit(20)
                    .toArray();
            } catch (profileError) {
                // Collect failures gracefully
                slowQueries = [{ error: profileError.message }];
            }
        }

        // Performance aggregation from requestHistory
        const nowRange = Date.now() - 60000; // last 60s
        const windowRequests = requestHistory.filter(r => r.timestamp >= nowRange);

        const throughput = windowRequests.length / 60; // reqs/sec over last 60 seconds
        const statuses = windowRequests.map(r => r.status);
        const errors = statuses.filter(s => s >= 500).length;
        const errorRate = windowRequests.length > 0 ? (errors / windowRequests.length) * 100 : 0;

        const sortedDurations = windowRequests.map(r => r.duration).sort((a, b) => a - b);
        const getPercentile = (durs, pct) => {
            if (durs.length === 0) return 0;
            const idx = Math.ceil((pct / 100) * durs.length) - 1;
            return durs[idx];
        };

        res.json({
            cpu: cpuPercentage.toFixed(2),
            memory: {
                rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + ' MB',
                heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB'
            },
            eventLoopLagMs: eventLoopLag,
            db: {
                connectionState: mongoose.connection.readyState,
                poolSize: mongoose.connection.options ? mongoose.connection.options.maxPoolSize : 0,
                connections: dbStatus,
                slowQueriesCount: slowQueries.length
            },
            throughput: throughput.toFixed(2) + ' req/sec',
            errorRate: errorRate.toFixed(2) + '%',
            latency: {
                p50: getPercentile(sortedDurations, 50).toFixed(2) + ' ms',
                p95: getPercentile(sortedDurations, 95).toFixed(2) + ' ms',
                p99: getPercentile(sortedDurations, 99).toFixed(2) + ' ms'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Periodic logging of server metrics to logs/app.log every 10s
setInterval(async () => {
    if (mongoose.connection.readyState === 1) {
        try {
            const stats = await mongoose.connection.db.command({ serverStatus: 1 });
            const nowRange = Date.now() - 10000;
            const recentReqs = requestHistory.filter(r => r.timestamp >= nowRange);
            const errors = recentReqs.filter(r => r.status >= 500).length;
            const errorRate = recentReqs.length > 0 ? (errors / recentReqs.length) * 100 : 0;

            writeLog('metric', 'Periodic Internal System Check', {
                cpuPct: cpuPercentage.toFixed(2),
                memoryMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
                eventLoopLagMs: eventLoopLag,
                dbConnectionsActive: stats.connections.current,
                throughputTenSec: (recentReqs.length / 10).toFixed(2),
                errorRatePct: errorRate.toFixed(2)
            });
        } catch (metricError) {
            writeLog('error', 'Failed during periodic system logging: ' + metricError.message);
        }
    }
}, 10000).unref();

// Global error handler (never leaks internals to raw clients but logs details)
app.use((err, req, res, next) => {
    writeLog('error', `Internal Server Error: ${err.message}`, {
        stack: err.stack,
        method: req.method,
        path: req.path
    });
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// -------------------------------------------------------------
// SERVE BUILT FRONTEND (production)
// -------------------------------------------------------------
// The client uses relative fetch calls ('/api/...', '/uploads/...').
// In dev, Vite's proxy (client/vite.config.js) forwards those to this
// server. In production there is no such proxy, so unless the built
// frontend is served from this exact same origin, every upload /
// preview / download / delete / clear call silently 404s or gets
// blocked by the browser (wrong origin). Run `npm run build` inside
// client/ before deploying, and this will pick the build up automatically.
const clientDistPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // SPA fallback: any non-API, non-upload route serves index.html so
    // client-side routing (React Router) works on a hard refresh / deep link.
    app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
    writeLog('info', 'Serving built frontend from client/dist');
} else {
    writeLog('info', 'client/dist not found — run "npm run build" in client/ to serve the frontend from this server in production. Using Vite dev server + proxy for now.');
}

app.listen(PORT, () => {
    writeLog('info', `Server started and listening on port ${PORT}`);
});