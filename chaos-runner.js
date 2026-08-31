const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    headers: {
        'Content-Type': 'application/json'
    }
};

let token = '';

function makeRequest(method, path, body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const reqOpts = {
            ...options,
            method,
            path,
            headers: {
                ...options.headers,
                ...extraHeaders
            }
        };
        if (token) {
            reqOpts.headers['Authorization'] = `Bearer ${token}`;
        }

        const start = Date.now();
        const req = http.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - start;
                let parsed = data;
                try { parsed = JSON.parse(data); } catch (e) { }
                resolve({ status: res.statusCode, body: parsed, duration });
            });
        });

        req.on('error', (err) => {
            resolve({ status: 500, error: err.message, duration: Date.now() - start });
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    console.log("=== CHAOS AND STRESS EXPERIMENTS RUNNER ===");

    // Login first
    console.log("\nLogging in...");
    const loginRes = await makeRequest('POST', '/api/auth/login', {
        username: 'testuser',
        password: 'password123'
    });
    if (loginRes.status !== 200 || !loginRes.body.token) {
        console.error("Login failed!", loginRes);
        process.exit(1);
    }
    token = loginRes.body.token;
    console.log("Logged in successfully. JWT Token acquired.");

    // Scenario 2: Slow Database
    console.log("\n--- Scenario 2: Slow Database ---");
    console.log("Requesting delayed DB query path (/api/chaos/slow-db)...");
    const slowDbRes = await makeRequest('GET', '/api/chaos/slow-db');
    console.log(`Response Status: ${slowDbRes.status}`);
    console.log(`Duration: ${slowDbRes.duration}ms`);
    console.log(`Response Body:`, slowDbRes.body);

    // Scenario 3: Downstream API Failure
    console.log("\n--- Scenario 3: Downstream API Failure ---");
    console.log("Firing 5 requests to client downstream gateway simulator...");
    for (let i = 0; i < 5; i++) {
        // We set a short connection timeout or just monitor the response
        const downstreamRes = await Promise.race([
            makeRequest('GET', '/api/chaos/downstream'),
            new Promise(r => setTimeout(() => r({ status: 504, error: 'Client Timeout Triggered' }), 4000))
        ]);
        if (downstreamRes.error) {
            console.log(`Request ${i + 1}: ERROR - ${downstreamRes.error}`);
        } else {
            console.log(`Request ${i + 1}: STATUS - ${downstreamRes.status}, Body: ${JSON.stringify(downstreamRes.body)}`);
        }
    }

    // Scenario 4: High CPU Blocking Event Loop
    console.log("\n--- Scenario 4: High CPU (Event Loop Pinning) ---");
    console.log("Triggering 5 second CPU busy loop on server, and concurrently requesting CPU-light statistics (/api/metrics)...");

    const cpuTriggerPromise = makeRequest('GET', '/api/chaos/cpu-pin');
    // Wait 500ms to ensure server is in the loop, then request metrics
    await new Promise(r => setTimeout(r, 500));

    const metricsPromise = makeRequest('GET', '/api/metrics');

    const [cpuResult, metricsResult] = await Promise.all([cpuTriggerPromise, metricsPromise]);
    console.log(`CPU Loop response Status: ${cpuResult.status} (took ${cpuResult.duration}ms)`);
    console.log(`Concurrent Metrics check status: ${metricsResult.status} (took ${metricsResult.duration}ms)`);
    console.log("Notice: The light metrics request was blocked and waited in queue until the synchronous loop completed!");

    // Scenario 5: High Memory usage
    console.log("\n--- Scenario 5: High Memory Allocation ---");
    console.log("Increasing memory allocation in stages (leaking 20MB per request)...");
    for (let i = 0; i < 10; i++) {
        const memRes = await makeRequest('GET', '/api/chaos/memory-leak');
        console.log(`Step ${i + 1}: Status: ${memRes.status}, Server Memory RSS: ${memRes.body.rss || 'N/A'}`);
    }

    // Scenario 6: Multiple Simultaneous Writes (Concurrency Race Conditions)
    console.log("\n--- Scenario 6: Multiple Simultaneous writes ---");
    console.log("Creating a single test order record...");
    const createRes = await makeRequest('POST', '/api/orders', {
        customerName: 'Race Test Original',
        item: 'iPhone 15',
        price: 999.00,
        quantity: 1
    });
    if (createRes.status !== 201) {
        console.error("Order creation failed!", createRes);
        return;
    }
    const orderId = createRes.body._id;
    console.log(`Created Order ID: ${orderId}`);

    console.log("Launching 50 concurrent updates (PUT requests) to the same order...");
    const promises = [];
    for (let i = 0; i < 50; i++) {
        promises.push(makeRequest('PUT', `/api/orders/${orderId}`, {
            customerName: `Concurrent Updater #${i}`,
            item: 'iPhone 15',
            price: 999.00,
            quantity: 1
        }));
    }
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    const errorCount = results.filter(r => r.status !== 200).length;
    console.log(`Results: ${successCount} successful updates, ${errorCount} failed updates.`);

    // Query record value to check consistency
    const finalCheck = await makeRequest('GET', `/api/orders/${orderId}`);
    console.log(`Final value in DB: customerName = "${finalCheck.body.customerName}"`);
    console.log("Mongoose default behavior: Last write wins, no database corruption, but updates are overwritten silently.");

    // Scenario 8: Network Delay Simulation
    console.log("\n--- Scenario 8: Network Delay Jitter ---");
    console.log("Sending query to network delay endpoint (/api/chaos/delay)...");
    const delayRes = await makeRequest('GET', '/api/chaos/delay');
    console.log(`Status: ${delayRes.status}, took ${delayRes.duration}ms`);

    console.log("\nChaos Runner complete.");
}

run().catch(console.error);
