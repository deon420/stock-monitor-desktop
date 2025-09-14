# Stock Monitor Web App Design Guidelines

## Design Approach
**System-Based Approach**: Utility-focused application using **Material Design** principles for data-heavy interfaces with clear visual feedback for monitoring states.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Primary: 220 70% 50% (Professional blue for trust/reliability)
- Primary Dark: 220 70% 35%
- Success: 120 60% 45% (In stock status)
- Warning: 35 85% 55% (Price changes)
- Error: 0 70% 50% (Out of stock)

**Dark Mode:**
- Background: 220 15% 8%
- Surface: 220 12% 12%
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%

### Typography
- **Primary**: Inter (Google Fonts)
- **Monospace**: JetBrains Mono (for prices/SKUs)
- Hierarchy: text-sm, text-base, text-lg, text-xl, text-2xl

### Layout System
**Tailwind Spacing**: Consistent use of 2, 4, 6, 8, 12, 16 units
- Cards: p-6, gap-4
- Sections: py-8, px-4
- Components: m-2, p-4

## Component Library

### Product Cards
- **Stock Status Indicators**: Colored badges (green/yellow/red) with clear labels
- **Price Display**: Large, monospace font with change indicators (↑↓)
- **Product Images**: 16:9 aspect ratio thumbnails
- **Action Buttons**: Edit, Delete, View History - subtle ghost buttons

### Dashboard Layout
- **Header**: App title, add product button, user settings
- **Filters**: Platform selector (Amazon/Walmart), status filters
- **Product Grid**: Responsive cards (1-3 columns based on screen size)
- **Status Bar**: Last check time, total products monitored

### Forms
- **Add Product**: URL input with platform auto-detection
- **Settings**: Email preferences, check intervals
- **Validation**: Real-time feedback with clear error states

### Notifications
- **Toast Messages**: Material Design snackbars for immediate feedback
- **Status Badges**: Persistent indicators on product cards
- **Email Status**: Visual confirmation of notification settings

### Data Visualization
- **Price History**: Simple line charts using Chart.js
- **Status Timeline**: Horizontal timeline showing availability changes
- **Summary Stats**: Card-based metrics (total savings, items tracked)

## Key Design Principles

1. **Status-First Design**: Stock availability and price changes are immediately visible
2. **Data Clarity**: Monospace fonts for prices, clear visual hierarchy for product information
3. **Trust Indicators**: Professional color scheme, consistent status reporting
4. **Efficiency**: Quick add/edit flows, bulk actions for power users
5. **Reliability**: Clear feedback for monitoring status and email delivery

## Responsive Behavior
- **Mobile**: Single column card layout, collapsible filters
- **Tablet**: Two-column grid, side navigation
- **Desktop**: Three-column grid, permanent sidebar for filters

The design emphasizes clarity and reliability over visual flair, matching the utility-focused nature of a monitoring application where users need quick, accurate information about their tracked products.