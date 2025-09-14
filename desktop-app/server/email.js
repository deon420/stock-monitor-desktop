const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  // Configure Gmail SMTP transporter
  async configureGmail(email, appPassword) {
    try {
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: email,
          pass: appPassword
        }
      });

      // Verify the connection
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      console.error('Gmail configuration failed:', error);
      return { 
        success: false, 
        error: this.getReadableError(error.message) 
      };
    }
  }

  // Test email configuration by sending a test email
  async testEmail(email, appPassword) {
    const config = await this.configureGmail(email, appPassword);
    if (!config.success) {
      return config;
    }

    try {
      await this.transporter.sendMail({
        from: email,
        to: email,
        subject: '🧪 Stock Monitor - Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">✅ Email Configuration Successful!</h2>
            <p>Your Stock Monitor email notifications are now configured and working properly.</p>
            <p>You'll receive alerts for:</p>
            <ul>
              <li>📉 Price drops on Amazon products</li>
              <li>📦 Stock availability changes on Walmart products</li>
            </ul>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <small style="color: #666;">
              This is a test email from Stock Monitor. You can safely ignore this message.
            </small>
          </div>
        `
      });

      return { success: true };
    } catch (error) {
      console.error('Test email failed:', error);
      return { 
        success: false, 
        error: this.getReadableError(error.message) 
      };
    }
  }

  // Send price drop notification
  async sendPriceDropAlert(email, appPassword, product) {
    const config = await this.configureGmail(email, appPassword);
    if (!config.success) {
      return config;
    }

    const savings = product.previousPrice - product.currentPrice;
    const discountPercent = Math.round((savings / product.previousPrice) * 100);

    try {
      await this.transporter.sendMail({
        from: email,
        to: email,
        subject: `💰 Price Drop Alert: ${product.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">📉 Price Drop Alert!</h2>
            </div>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
              <h3 style="color: #333; margin-top: 0;">${product.name}</h3>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <span style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                    ${product.platform === 'amazon' ? '🛒 Amazon' : '🏪 Walmart'}
                  </span>
                </div>
                
                <div style="margin: 15px 0;">
                  <div style="font-size: 18px; color: #4CAF50; font-weight: bold;">
                    Now: $${product.currentPrice}
                  </div>
                  <div style="text-decoration: line-through; color: #666; margin: 5px 0;">
                    Was: $${product.previousPrice}
                  </div>
                  <div style="background: #4CAF50; color: white; padding: 6px 12px; border-radius: 20px; display: inline-block; font-weight: bold;">
                    Save $${savings.toFixed(2)} (${discountPercent}% off!)
                  </div>
                </div>
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${product.url}" 
                   style="background: #ff9500; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;"
                   target="_blank">
                  🛒 View Product
                </a>
              </div>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
              <small style="color: #666;">
                Stock Monitor - Automated price tracking for Amazon & Walmart
              </small>
            </div>
          </div>
        `
      });

      return { success: true };
    } catch (error) {
      console.error('Price drop email failed:', error);
      return { 
        success: false, 
        error: this.getReadableError(error.message) 
      };
    }
  }

  // Send stock alert notification
  async sendStockAlert(email, appPassword, product) {
    const config = await this.configureGmail(email, appPassword);
    if (!config.success) {
      return config;
    }

    try {
      await this.transporter.sendMail({
        from: email,
        to: email,
        subject: `📦 Back in Stock: ${product.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">📦 Back in Stock!</h2>
            </div>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
              <h3 style="color: #333; margin-top: 0;">${product.name}</h3>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <span style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                    ${product.platform === 'amazon' ? '🛒 Amazon' : '🏪 Walmart'}
                  </span>
                  <span style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                    ✅ In Stock
                  </span>
                </div>
                
                ${product.currentPrice ? `
                  <div style="margin: 15px 0; font-size: 18px; font-weight: bold; color: #333;">
                    Price: $${product.currentPrice}
                  </div>
                ` : ''}
              </div>
              
              <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 0; color: #1976D2; font-weight: bold;">
                  🚨 Don't miss out! This product was previously out of stock.
                </p>
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${product.url}" 
                   style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;"
                   target="_blank">
                  🛒 Buy Now
                </a>
              </div>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
              <small style="color: #666;">
                Stock Monitor - Automated stock tracking for Amazon & Walmart
              </small>
            </div>
          </div>
        `
      });

      return { success: true };
    } catch (error) {
      console.error('Stock alert email failed:', error);
      return { 
        success: false, 
        error: this.getReadableError(error.message) 
      };
    }
  }

  // Convert technical error messages to user-friendly ones
  getReadableError(errorMessage) {
    if (errorMessage.includes('Invalid login')) {
      return 'Invalid email or app password. Please check your credentials.';
    }
    if (errorMessage.includes('Username and Password not accepted')) {
      return 'Gmail rejected your credentials. Make sure you\'re using an App Password, not your regular password.';
    }
    if (errorMessage.includes('authentication failed')) {
      return 'Authentication failed. Please verify your Gmail address and App Password.';
    }
    if (errorMessage.includes('connect ENOTFOUND')) {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (errorMessage.includes('timeout')) {
      return 'Connection timeout. Please try again in a moment.';
    }
    
    return 'Email configuration failed. Please check your settings and try again.';
  }
}

module.exports = new EmailService();