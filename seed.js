const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = 'mongodb://127.0.0.1:27017/scalability_db';

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

const User = mongoose.model('User', UserSchema);
const Order = mongoose.model('Order', OrderSchema);

const names = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince', 'Evan Wright', 'Fiona Gallagher', 'George Clark', 'Hannah Abbott', 'Ian Malcolm', 'Julia Roberts'];
const items = ['MacBook Pro', 'iPhone 15', 'Dell XPS', 'Wireless Mouse', 'Mechanical Keyboard', '4K Monitor', 'USB-C Cable', 'Noise Cancelling Headphones', 'Coffee Mug', 'Standing Desk'];

async function seed() {
    console.log("Connecting to Database...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected. Clearing old data...");
    await User.deleteMany({});
    await Order.deleteMany({});

    console.log("Creating default user 'testuser' with password 'password123'...");
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = new User({ username: 'testuser', password: hashedPassword });
    await user.save();
    console.log("User created. User ID:", user._id);

    console.log("Generating 5000 random order records...");
    const bulkOrders = [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 5000; i++) {
        const name = names[Math.floor(Math.random() * names.length)];
        const item = items[Math.floor(Math.random() * items.length)];
        const price = parseFloat((Math.random() * 2000 + 10).toFixed(2));
        const quantity = Math.floor(Math.random() * 5) + 1;
        const createdAt = new Date(thirtyDaysAgo + Math.random() * (Date.now() - thirtyDaysAgo));

        // Simulating CC number
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

    console.log("Inserting orders in bulk...");
    await Order.insertMany(bulkOrders);
    console.log("DB Seeding Complete! Seeded 1 User and 5000 Orders successfully.");
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error("Error during seeding:", err);
    process.exit(1);
});
