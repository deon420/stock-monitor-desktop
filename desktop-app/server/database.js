const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple JSON-based storage for desktop app (no native dependencies)
const dbPath = path.join(__dirname, 'stock-monitor-data.json');

// Initialize storage file if it doesn't exist
function initializeStorage() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      users: {},
      products: {},
      priceHistory: {},
      nextId: 1
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

// Simple storage functions
function readData() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (error) {
    console.error('Error reading data:', error);
    return { users: {}, products: {}, priceHistory: {}, nextId: 1 };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data:', error);
  }
}

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

// Database operations
class StandaloneStorage {
  constructor() {
    try {
      initializeStorage();
      console.log('✅ JSON storage initialized successfully');
    } catch (error) {
      console.error('Storage initialization failed:', error.message);
      console.log('Some features may not work properly.');
    }
  }
  
  // User operations
  createUser(username, password) {
    const data = readData();
    const id = generateId();
    
    data.users[id] = {
      id,
      username,
      password,
      created_at: new Date().toISOString()
    };
    
    writeData(data);
    return data.users[id];
  }
  
  getUser(id) {
    const data = readData();
    return data.users[id] || null;
  }
  
  getUserByUsername(username) {
    const data = readData();
    return Object.values(data.users).find(user => user.username === username) || null;
  }
  
  // Product operations
  addProduct(userId, product) {
    const data = readData();
    const id = generateId();
    
    data.products[id] = {
      id,
      user_id: userId,
      name: product.name,
      url: product.url,
      platform: product.platform,
      asin: product.asin || null,
      current_price: null,
      target_price: product.targetPrice || null,
      is_in_stock: true,
      notify_on_price_drop: product.notifyOnPriceDrop || false,
      notify_on_stock_change: product.notifyOnStockChange || false,
      last_checked: null,
      created_at: new Date().toISOString()
    };
    
    writeData(data);
    return data.products[id];
  }
  
  getProduct(id) {
    const data = readData();
    return data.products[id] || null;
  }
  
  getUserProducts(userId) {
    const data = readData();
    return Object.values(data.products)
      .filter(product => product.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  
  updateProductPrice(productId, price, isInStock) {
    const data = readData();
    
    if (data.products[productId]) {
      data.products[productId].current_price = price;
      data.products[productId].is_in_stock = isInStock;
      data.products[productId].last_checked = new Date().toISOString();
      
      // Add to price history
      const historyId = generateId();
      data.priceHistory[historyId] = {
        id: historyId,
        product_id: productId,
        price,
        is_in_stock: isInStock,
        checked_at: new Date().toISOString()
      };
      
      writeData(data);
    }
  }
  
  deleteProduct(productId) {
    const data = readData();
    const existed = !!data.products[productId];
    
    delete data.products[productId];
    
    // Remove associated price history
    Object.keys(data.priceHistory).forEach(historyId => {
      if (data.priceHistory[historyId].product_id === productId) {
        delete data.priceHistory[historyId];
      }
    });
    
    writeData(data);
    return { changes: existed ? 1 : 0 };
  }
  
  // Get products that need checking
  getProductsForMonitoring(platform) {
    const data = readData();
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
    
    return Object.values(data.products)
      .filter(product => {
        if (product.platform !== platform) return false;
        
        if (!product.last_checked) return true;
        
        const lastChecked = new Date(product.last_checked);
        
        if (platform === 'walmart') {
          return lastChecked < oneMinuteAgo;
        } else {
          return lastChecked < fifteenMinutesAgo;
        }
      })
      .slice(0, 10);
  }
  
  // Get price history for a product
  getProductPriceHistory(productId, days = 30) {
    const data = readData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return Object.values(data.priceHistory)
      .filter(history => 
        history.product_id === productId && 
        new Date(history.checked_at) >= cutoffDate
      )
      .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
  }
}

module.exports = { StandaloneStorage };