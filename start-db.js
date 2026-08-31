const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, 'db-data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

async function start() {
    console.log("Starting MongoDB with persistence at", dbDir);
    try {
        const mongod = await MongoMemoryServer.create({
            instance: {
                port: 27017,
                dbPath: dbDir,
                storageEngine: 'wiredTiger',
            }
        });
        console.log("MongoDB is running on:", mongod.getUri());
    } catch (e) {
        console.error("Failed to start with WiredTiger. Error:", e);
        console.log("Trying fallback ephemeral engine...");
        try {
            const mongod = await MongoMemoryServer.create({
                instance: {
                    port: 27017,
                }
            });
            console.log("MongoDB is running on fallback:", mongod.getUri());
        } catch (err2) {
            console.error("Fallback engine also failed:", err2);
            process.exit(1);
        }
    }
}

// Keep the process alive
setInterval(() => {
    // Keeping process alive
}, 60000);

start().catch(err => {
    console.error("Startup error:", err);
    process.exit(1);
});
