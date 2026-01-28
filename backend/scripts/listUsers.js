require('dotenv').config();
const connectDB = require('../src/config/db');
const User = require('../src/models/User.model');

const listUsers = async () => {
  try {
    await connectDB();

    const users = await User.find({}).select('phoneNumber role isActive tenantId createdAt updatedAt');

    if (!users || users.length === 0) {
      console.log('No users found in the database.');
      process.exit(0);
    }

    console.log('Registered users:\n');
    users.forEach((u) => {
      console.log(`- id: ${u._id}`);
      console.log(`  phoneNumber: ${u.phoneNumber}`);
      console.log(`  role: ${u.role}`);
      console.log(`  isActive: ${u.isActive}`);
      console.log(`  tenantId: ${u.tenantId}`);
      console.log(`  createdAt: ${u.createdAt}`);
      console.log('');
    });

    process.exit(0);
  } catch (err) {
    console.error('Failed to list users:', err);
    process.exit(1);
  }
};

listUsers();
