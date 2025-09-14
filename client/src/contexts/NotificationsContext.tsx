import { createContext, useContext, useState, ReactNode } from 'react'

// Shared Notification interface
export interface Notification {
  id: string
  type: "price_drop" | "stock_alert"
  productId: string
  productName: string
  platform: "amazon" | "walmart"
  timestamp: Date
  data: {
    // For price drops
    currentPrice?: number
    previousPrice?: number
    savings?: number
    discountPercent?: number
    
    // For stock alerts
    inStock?: boolean
    
    // Common
    productUrl?: string
  }
  read: boolean
}

interface NotificationsContextType {
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}

// Initial mock notifications for demo
const initialNotifications: Notification[] = [
  {
    id: "1",
    type: "price_drop",
    productId: "1",
    productName: "Wireless Bluetooth Headphones",
    platform: "amazon",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    data: {
      currentPrice: 89.99,
      previousPrice: 119.99,
      savings: 30,
      discountPercent: 25,
      productUrl: "https://amazon.com/product/123"
    },
    read: false
  },
  {
    id: "2",
    type: "stock_alert",
    productId: "6",
    productName: "Wireless Phone Charger",
    platform: "walmart",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    data: {
      inStock: true,
      productUrl: "https://walmart.com/product/303"
    },
    read: false
  },
  {
    id: "3",
    type: "price_drop",
    productId: "2",
    productName: "Smart Fitness Tracker",
    platform: "amazon", 
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    data: {
      currentPrice: 79.99,
      previousPrice: 99.99,
      savings: 20,
      discountPercent: 20,
      productUrl: "https://amazon.com/product/456"
    },
    read: true
  },
  {
    id: "4",
    type: "stock_alert",
    productId: "7",
    productName: "Portable Bluetooth Speaker",
    platform: "walmart",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    data: {
      inStock: true,
      productUrl: "https://walmart.com/product/789"
    },
    read: true
  },
  {
    id: "5",
    type: "price_drop",
    productId: "3",
    productName: "USB-C Cable 3-Pack",
    platform: "amazon",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    data: {
      currentPrice: 19.99,
      previousPrice: 29.99,
      savings: 10,
      discountPercent: 33,
      productUrl: "https://amazon.com/product/789"
    },
    read: true
  }
]

interface NotificationsProviderProps {
  children: ReactNode
}

export const NotificationsProvider = ({ children }: NotificationsProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev])
  }

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}