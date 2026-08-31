const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/scalability_db';

const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerName: { type: String, required: true },
    item: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    creditCardNumber: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', OrderSchema);

const names = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince', 'Evan Wright', 'Fiona Gallagher', 'George Clark', 'Hannah Abbott', 'Ian Malcolm', 'Julia Roberts'];
const items = ['MacBook Pro', 'iPhone 15', 'Dell XPS', 'Wireless Mouse', 'Mechanical Keyboard', '4K Monitor', 'USB-C Cable', 'Noise Cancelling Headphones', 'Coffee Mug', 'Standing Desk'];

async function seed() {
    console.log("Connecting to Database for large seeding...");
    await mongoose.connect(MONGO_URI);
    console.log("Querying default user ID...");
    const UserSchema = new mongoose.Schema({ username: String });
    const User = mongoose.model('User', UserSchema);
    const user = await User.findOne({ username: 'testuser' });
    if (!user) {
        throw new Error("Default user 'testuser' not found. Run seed.js first!");
    }

    console.log("Seeding 95,000 more orders in chunks of 5,000...");
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (let chunk = 0; chunk < 19; chunk++) {
        const bulkOrders = [];
        for (let i = 0; i < 5000; i++) {
            const name = names[Math.floor(Math.random() * names.length)];
            const item = items[Math.floor(Math.random() * items.length)];
            const price = parseFloat((Math.random() * 2000 + 10).toFixed(2));
            const quantity = Math.floor(Math.random() * 5) + 1;
            const createdAt = new Date(thirtyDaysAgo + Math.random() * (Date.now() - thirtyDaysAgo));
            const cc = '4111-xxxx-xxxx-' + Math.floor(1000 + Math.random() * 9000);

            bulkOrders.push({
                userId: user._id,
                customerName: name,
                item,
                price,
                quantity,
                creditCardNumber: cc,
                createdAt
            });
        }
        await Order.insertMany(bulkOrders);
        console.log(`Inserted chunk ${chunk + 1}/19 (cumulative: ${(chunk + 1) * 5000} orders)`);
    }

    console.log("Large dataset seeding complete!");
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error("Large seeding failed:", err);
    process.exit(1);
});
