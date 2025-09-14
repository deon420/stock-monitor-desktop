#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
// const open = require('open'); // Commented out for standalone compatibility
const { StandaloneStorage } = require('./database.js');
const emailService = require('./email.js');

// Initialize app and database
const app = express();
let storage;
const PORT = 3000;

try {
  storage = new StandaloneStorage();
  console.log('✅ Storage initialized successfully');
} catch (error) {
  console.error('⚠️  Storage initialization failed:', error.message);
  console.log('Running in limited mode...');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Simple session management (in-memory for standalone app)
let currentUser = null;

// Enhanced user agents for scraping
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Challenge detection
function detectChallengePage(html, url) {
  const challengeIndicators = [
    'Robot Check', 'Robot or human?', 'Something went wrong',
    'To discuss automated access', 'automated queries', 'unusual traffic',
    'blocked', 'captcha', 'Please confirm that you are a human',
    'Security check', 'Access Denied'
  ];
  
  const lowerHtml = html.toLowerCase();
  return challengeIndicators.some(indicator => 
    lowerHtml.includes(indicator.toLowerCase())
  );
}

// Enhanced scraping function
async function scrapeProduct(url, platform, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Scraping attempt ${attempt}/${maxRetries} for ${platform}: ${url}`);
      
      if (attempt > 1) {
        const baseDelay = platform === 'walmart' ? 3000 : 2000;
        const randomDelay = Math.random() * 3000 + baseDelay;
        console.log(`Waiting ${Math.round(randomDelay)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
      
      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/'
      };
      
      const response = await axios.get(url, {
        headers,
        timeout: 30000,
        maxRedirects: 5
      });
      
      if (detectChallengePage(response.data, url)) {
        if (attempt < maxRetries) {
          const challengeDelay = Math.pow(2, attempt) * 2000 + Math.random() * 2000;
          console.log(`Challenge detected, backing off for ${Math.round(challengeDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, challengeDelay));
          continue;
        } else {
          console.log('Challenge page persists after all retries');
          return { price: null, inStock: false, error: 'Blocked by anti-bot protection' };
        }
      }
      
      const $ = cheerio.load(response.data);
      let price = null;
      let inStock = true;
      
      if (platform === 'amazon') {
        // Amazon price selectors
        const priceSelectors = [
          '.a-price-whole',
          '.a-offscreen',
          '#corePrice_feature_div .a-price .a-offscreen',
          '#apex_desktop .a-price .a-offscreen',
          '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen'
        ];
        
        for (const selector of priceSelectors) {
          const priceText = $(selector).first().text().trim();
          if (priceText && priceText.includes('$')) {
            price = parseFloat(priceText.replace(/[$,]/g, ''));
            if (!isNaN(price)) break;
          }
        }
        
        // Amazon stock detection
        const unavailableText = $('#availability span').text().toLowerCase();
        if (unavailableText.includes('unavailable') || unavailableText.includes('out of stock')) {
          inStock = false;
        }
        
      } else if (platform === 'walmart') {
        // Walmart price selectors
        const priceSelectors = [
          '[data-testid="price-current"]',
          '[data-automation-id="product-price"]',
          '.price-current',
          '[data-testid="price-display"] span'
        ];
        
        for (const selector of priceSelectors) {
          const priceText = $(selector).first().text().trim();
          if (priceText && priceText.includes('$')) {
            price = parseFloat(priceText.replace(/[$,]/g, ''));
            if (!isNaN(price)) break;
          }
        }
        
        // Walmart stock detection
        const stockText = $('[data-testid="fulfillment-add-to-cart"] button').text().toLowerCase();
        if (stockText.includes('out of stock') || stockText.includes('unavailable')) {
          inStock = false;
        }
      }
      
      console.log(`[${new Date().toLocaleTimeString()}] Successfully scraped ${platform}: Price=$${price || 'N/A'}, In Stock=${inStock}`);
      return { price, inStock, error: null };
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Scraping attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return { price: null, inStock: false, error: error.message };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return { price: null, inStock: false, error: 'All attempts failed' };
}

// ========================================
// DEPRECATED INSECURE AUTHENTICATION
// ========================================
// The old insecure authentication system has been replaced with secure JWT-based authentication.
// Desktop app now uses the main server's secure authentication system with proper password hashing,
// token management, and security controls.

// Legacy login endpoint - DISABLED for security
app.post('/api/login', (req, res) => {
  console.warn('[SECURITY] Legacy insecure login endpoint called - this has been disabled');
  console.warn('[SECURITY] Please use the secure desktop authentication system');
  
  res.status(410).json({
    error: 'Legacy authentication system disabled',
    message: 'This app now uses secure authentication. Please restart the application and use the new login screen.',
    migration: {
      reason: 'The previous authentication system stored passwords in plaintext and had no proper security controls.',
      improvement: 'Now uses industry-standard JWT tokens, encrypted password storage, and proper session management.'
    }
  });
});

// Legacy user endpoint - DISABLED for security
app.get('/api/user', (req, res) => {
  console.warn('[SECURITY] Legacy user endpoint called - this has been disabled');
  
  res.status(410).json({
    error: 'Legacy user system disabled',
    message: 'This app now uses secure user management. Please restart the application.',
  });
});

// Legacy logout endpoint - DISABLED for security  
app.post('/api/logout', (req, res) => {
  console.warn('[SECURITY] Legacy logout endpoint called - this has been disabled');
  
  res.status(410).json({
    error: 'Legacy logout system disabled',
    message: 'This app now uses secure session management. Please restart the application.',
  });
});

// Security notice endpoint for debugging
app.get('/api/security-status', (req, res) => {
  res.json({
    status: 'secure',
    message: 'Desktop app now uses secure JWT-based authentication',
    features: [
      'Industry-standard JWT tokens',
      'Encrypted password storage (AES-256-GCM)',
      'Proper session management',
      'Token refresh functionality',
      'Rate limiting protection',
      'Secure remember-me functionality'
    ],
    migration_complete: true,
    legacy_endpoints_disabled: true
  });
});

// Email test route
app.post('/api/test-email', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('[EMAIL] Testing email configuration for:', email);
    const result = await emailService.testEmail(email, password);
    
    if (result.success) {
      console.log('[EMAIL] Test email sent successfully');
      res.json({ success: true, message: 'Test email sent successfully!' });
    } else {
      console.log('[EMAIL] Test email failed:', result.error);
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('[EMAIL] Test email error:', error);
    res.status(500).json({ error: 'Failed to test email configuration' });
  }
});

app.get('/api/products', (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const products = storage.getUserProducts(currentUser.id);
  res.json({ products });
});

app.post('/api/products', async (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { name, url, platform, asin, targetPrice, notifyOnPriceDrop, notifyOnStockChange } = req.body;
  
  if (!name || !url || !platform) {
    return res.status(400).json({ error: 'Name, URL, and platform are required' });
  }
  
  // Set default notification preferences based on platform
  const productData = {
    name,
    url,
    platform,
    asin,
    targetPrice,
    notifyOnPriceDrop: notifyOnPriceDrop !== undefined ? notifyOnPriceDrop : (platform === 'amazon'),
    notifyOnStockChange: notifyOnStockChange !== undefined ? notifyOnStockChange : (platform === 'walmart')
  };
  
  try {
    const product = storage.addProduct(currentUser.id, productData);
    
    // Try to get initial price
    const result = await scrapeProduct(url, platform);
    if (result.price !== null) {
      storage.updateProductPrice(product.id, result.price, result.inStock);
    }
    
    res.json({ product: storage.getProduct(product.id) });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const productId = req.params.id;
  const result = storage.deleteProduct(productId);
  
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Monitoring scheduler
function startMonitoring() {
  console.log('Starting product monitoring...');
  
  // Amazon monitoring every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Running Amazon price check...`);
    const products = storage.getProductsForMonitoring('amazon');
    
    for (const product of products) {
      try {
        const result = await scrapeProduct(product.url, 'amazon');
        if (result.price !== null) {
          storage.updateProductPrice(product.id, result.price, result.inStock);
          
          // Check for price drop notifications
          if (product.notify_on_price_drop && product.current_price && result.price < product.current_price) {
            console.log(`Price drop detected for ${product.name}: $${product.current_price} → $${result.price}`);
            // TODO: Send notification
          }
        }
      } catch (error) {
        console.error(`Failed to check ${product.name}:`, error.message);
      }
      
      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });
  
  // Walmart monitoring every 1 minute
  cron.schedule('* * * * *', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Running Walmart stock check...`);
    const products = storage.getProductsForMonitoring('walmart');
    
    for (const product of products) {
      try {
        const result = await scrapeProduct(product.url, 'walmart');
        if (result.price !== null) {
          storage.updateProductPrice(product.id, result.price, result.inStock);
          
          // Check for stock change notifications
          if (product.notify_on_stock_change && product.is_in_stock !== result.inStock) {
            console.log(`Stock change detected for ${product.name}: ${result.inStock ? 'Back in stock!' : 'Out of stock'}`);
            // TODO: Send notification
          }
        }
      } catch (error) {
        console.error(`Failed to check ${product.name}:`, error.message);
      }
      
      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });
}

// Export function to start server (for Electron integration)
function startServer(port = 3000) {
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`🛒 Stock Monitor server started on port ${port}`);
    console.log('📊 Monitoring Schedule: Amazon (15min), Walmart (1min)');
    
    // Start monitoring
    startMonitoring();
  });
  
  return server;
}

// For standalone usage (backwards compatibility)
if (require.main === module) {
  startServer(PORT);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n📴 Shutting down Stock Monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n📴 Shutting down Stock Monitor...');
  process.exit(0);
});

module.exports = { startServer, app };