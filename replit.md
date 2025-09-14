# Stock Monitor Web Application

## Overview

This is a stock monitoring application that tracks product availability and prices across Amazon and Walmart. The application allows users to add products by URL or ASIN, monitor stock status changes, receive price drop notifications, and get email alerts when products become available. Built with a React frontend using shadcn/ui components and a Node.js/Express backend with web scraping capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for development and building
- **UI Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **Styling**: Tailwind CSS with custom design system following Material Design principles
- **Theme System**: Light/dark mode support with system preference detection

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Web Scraping**: Cheerio for HTML parsing with Axios for HTTP requests
- **Product Scheduling**: Custom scheduler with backoff strategies and concurrency limiting
- **Session Management**: Express sessions with PostgreSQL session store
- **Email Service**: SendGrid integration for notifications
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: User management system with plans for product and monitoring data
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple

### Authentication and Authorization
- **Session-based Authentication**: Express sessions with secure cookie configuration
- **User Management**: Basic user registration and login system
- **Security**: Password hashing and session security best practices

### Product Monitoring System
- **Platform Support**: Amazon and Walmart product tracking
- **Scraping Strategy**: Intelligent scheduling with different intervals per platform (15min for Amazon, 1min for Walmart)
- **Rate Limiting**: Concurrent job limiting and exponential backoff for failed requests
- **Data Extraction**: ASIN extraction, price monitoring, and stock status detection
- **Notification System**: Email alerts for stock availability and price changes

### Component Architecture
- **Modular Design**: Reusable UI components with clear separation of concerns
- **Design System**: Consistent spacing, typography, and color schemes
- **Responsive Layout**: Mobile-first design with adaptive grid layouts
- **Accessibility**: ARIA labels and keyboard navigation support

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting for production data storage
- **Drizzle Kit**: Database migration and schema management tooling

### Email Services
- **SendGrid**: Transactional email service for stock and price alerts
- **SMTP Configuration**: Email delivery with template support

### UI and Styling
- **Radix UI**: Headless UI components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Lucide React**: Icon library for consistent iconography
- **Google Fonts**: Inter font for typography

### Development Tools
- **Vite**: Fast development server and build tool with HMR
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production builds
- **Replit Integration**: Development environment integration with error overlays

### Web Scraping
- **Axios**: HTTP client for making requests to e-commerce sites
- **Cheerio**: Server-side jQuery implementation for HTML parsing
- **User-Agent Rotation**: Request headers to avoid detection

### Authentication
- **Express Session**: Session management with PostgreSQL backing
- **Connect PG Simple**: PostgreSQL session store adapter
- **Crypto**: Built-in Node.js crypto for secure operations