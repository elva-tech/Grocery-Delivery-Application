const mongoose = require('mongoose');
const Product = require('./src/models/Product.model');
const Inventory = require('./src/models/Inventory.model');

async function checkProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/grocery');
    console.log('Connected!');
    
    const allProducts = await Product.find().select('name isAvailable tenantId price');
    console.log('\n=== ALL PRODUCTS ===');
    console.log('Total products:', allProducts.length);
    allProducts.slice(0, 20).forEach((p, i) => {
      console.log(`${i+1}. ${p.name} - Available: ${p.isAvailable}, Tenant: ${p.tenantId}, Price: ${p.price}`);
    });
    
    const inventories = await Inventory.find();
    console.log('\n=== INVENTORIES ===');
    console.log('Total inventories:', inventories.length);
    if (inventories.length > 0) {
      console.log('Sample inventory:', { productId: inventories[0].productId, qty: inventories[0].availableQty });
    }
    
    // Count products with inventory
    console.log('\n=== PRODUCTS WITH INVENTORY ===');
    const withInventory = await Product.aggregate([
      { $lookup: { from: 'inventories', localField: '_id', foreignField: 'productId', as: 'inventory' } },
      { $unwind: { path: '$inventory', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$_id', name: { $first: '$name' }, inventoryCount: { $sum: 1 } } }
    ]);
    
    const productsWithInv = withInventory.filter(p => p.inventoryCount > 0);
    console.log('Total products WITH inventory:', productsWithInv.length);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}
checkProducts();
