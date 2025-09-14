// Mock data for web demo
import { Product, AppSettings } from './dataProvider'

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Bluetooth Headphones with Active Noise Cancellation",
    url: "https://amazon.com/product/123",
    platform: "amazon" as const,
    currentPrice: 89.99,
    previousPrice: 119.99,
    status: "in-stock" as const,
    lastChecked: new Date(),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "2", 
    name: "Smart Home Security Camera 1080P WiFi",
    url: "https://walmart.com/product/456",
    platform: "walmart" as const,
    currentPrice: 45.99,
    previousPrice: 45.99,
    status: "low-stock" as const,
    lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: false
  },
  {
    id: "3",
    name: "Portable Power Bank 20000mAh Fast Charging",
    url: "https://amazon.com/product/789", 
    platform: "amazon" as const,
    currentPrice: 39.99,
    previousPrice: 49.99,
    status: "out-of-stock" as const,
    lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "4",
    name: "Fitness Tracker with Heart Rate Monitor",
    url: "https://walmart.com/product/101",
    platform: "walmart" as const,
    currentPrice: 79.99,
    previousPrice: 99.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 30 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: false
  },
  {
    id: "5",
    name: "Gaming Mechanical Keyboard RGB Backlit",
    url: "https://amazon.com/product/202",
    platform: "amazon" as const,
    currentPrice: 129.99,
    previousPrice: 159.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 15 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "6",
    name: "Wireless Phone Charger Stand 15W",
    url: "https://walmart.com/product/303",
    platform: "walmart" as const,
    currentPrice: 24.99,
    previousPrice: 29.99,
    status: "out-of-stock" as const,
    lastChecked: new Date(Date.now() - 3 * 60 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: false
  },
  {
    id: "7",
    name: "Smart Watch Series 8 GPS + Cellular",
    url: "https://amazon.com/product/404",
    platform: "amazon" as const,
    currentPrice: 249.99,
    previousPrice: 399.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 10 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "8",
    name: "4K Webcam with Auto Focus",
    url: "https://walmart.com/product/505",
    platform: "walmart" as const,
    currentPrice: 89.99,
    previousPrice: 129.99,
    status: "low-stock" as const,
    lastChecked: new Date(Date.now() - 45 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: true
  },
  {
    id: "9",
    name: "Wireless Earbuds Pro with ANC",
    url: "https://amazon.com/product/606",
    platform: "amazon" as const,
    currentPrice: 179.99,
    previousPrice: 199.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 5 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  }
]

export const mockSettings: AppSettings = {
  amazonCheckInterval: 20, // minutes
  walmartCheckInterval: 10, // minutes
  enableRandomization: true,
  enableAudio: true,
  priceDropSound: "chime",
  stockAlertSound: "bell", 
  audioVolume: 80,
  enableEmail: false,
  gmailEmail: "",
  gmailAppPassword: "",
  testEmailSent: false
}