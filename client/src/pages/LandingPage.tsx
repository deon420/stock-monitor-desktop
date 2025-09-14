import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthChoiceModal } from "@/components/AuthChoiceModal";
import DemoModal from "@/components/DemoModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Monitor, 
  Zap, 
  Mail, 
  Shield, 
  Download, 
  CheckCircle, 
  Bell,
  TrendingDown,
  Package,
  Star,
  Users,
  Clock,
  Smartphone,
  DollarSign,
  ArrowRight,
  Heart,
  Globe,
  Headphones,
  UserPlus,
  LogIn
} from "lucide-react";

export default function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'choice' | 'signup' | 'login'>('choice');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  const openSignupModal = () => {
    setAuthModalMode('signup');
    setAuthModalOpen(true);
  };

  const openLoginModal = () => {
    setAuthModalMode('login');
    setAuthModalOpen(true);
  };

  const openAuthChoiceModal = () => {
    setAuthModalMode('choice');
    setAuthModalOpen(true);
  };

  const handleDemoClick = () => {
    if (isMobile) {
      // Mobile: Navigate to dashboard page
      setLocation('/dashboard');
    } else {
      // Desktop: Open demo modal
      setDemoModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Monitor className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Stock Monitor</span>
          </div>
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-features">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-pricing">
                Pricing
              </a>
              <a href="#download" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-download">
                Download
              </a>
            </nav>
            <ThemeToggle />
            <Button 
              size="sm" 
              onClick={openLoginModal}
              data-testid="button-header-login"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
            <Button 
              size="sm" 
              onClick={openSignupModal}
              data-testid="button-header-signup"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-gradient-to-br from-primary/5 via-background to-chart-1/5">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-6">
            <Badge variant="secondary" className="px-3 py-1 text-sm" data-testid="badge-hero">
              🚀 Track, Save, Celebrate
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Never Miss a 
              <span className="text-primary"> Great Deal</span> Again 📈
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Get notified when prices drop and items come back in stock. 
              Fast alerts 💨, quick email notifications 📧, and no more checking manually! 🎯
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="text-lg px-8 py-3"
                onClick={openAuthChoiceModal}
                data-testid="button-hero-signup"
              >
                Start Saving Today 💰
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-3"
                onClick={handleDemoClick}
                data-testid="button-hero-demo"
              >
                See Demo 👀
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-chart-1" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-chart-1" />
                <span>No spam emails</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-chart-1" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">1000+</div>
              <div className="text-sm text-muted-foreground">Products Tracked Daily 📦</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">$50K+</div>
              <div className="text-sm text-muted-foreground">Saved by Users 💵</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">5min</div>
              <div className="text-sm text-muted-foreground">Average Response Time ⚡</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">Monitoring Service 🔄</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              How It Works 🛠️
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simple setup, powerful results. Start saving money in just 3 easy steps! 🎉
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card className="hover-elevate border-0 shadow-lg" data-testid="card-feature-add">
              <CardHeader className="text-center">
                <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Add Products 📝</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Just paste any Amazon or Walmart URL. Our system automatically detects 
                  product details and starts tracking immediately! 🚀
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-0 shadow-lg" data-testid="card-feature-monitor">
              <CardHeader className="text-center">
                <div className="mx-auto bg-chart-2/10 p-3 rounded-full mb-4">
                  <Monitor className="h-8 w-8 text-chart-2" />
                </div>
                <CardTitle className="text-xl">We Monitor 👁️</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Our smart bots check prices and stock levels around the clock. 
                  No more manual checking - we've got you covered! 🤖
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-0 shadow-lg" data-testid="card-feature-notify">
              <CardHeader className="text-center">
                <div className="mx-auto bg-chart-1/10 p-3 rounded-full mb-4">
                  <Bell className="h-8 w-8 text-chart-1" />
                </div>
                <CardTitle className="text-xl">Get Notified 🔔</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Fast alerts when prices drop or items restock. Email notifications 
                  that actually arrive on time! 📧✨
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">
                Smart Price Tracking 💡
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <TrendingDown className="h-5 w-5 text-chart-1 mt-1" />
                  <div>
                    <h4 className="font-semibold">Price Drop Alerts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when prices drop, with percentage savings and comparison data 📊
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-chart-2 mt-1" />
                  <div>
                    <h4 className="font-semibold">Stock Monitoring</h4>
                    <p className="text-sm text-muted-foreground">
                      Know immediately when out-of-stock items become available again 🎯
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Flexible Timing</h4>
                    <p className="text-sm text-muted-foreground">
                      Customize check intervals from 5 minutes to hours - you're in control ⏰
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-chart-1/5 border-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Price</span>
                  <Badge variant="outline">-23% 📉</Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-chart-1">$76.99</div>
                  <div className="text-sm text-muted-foreground line-through">$99.99</div>
                </div>
                <div className="bg-background/50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-chart-1">
                    🎉 Great news! Price dropped by $23.00
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Notification sent 2 minutes ago
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Simple Pricing 💰
            </h2>
            <p className="text-xl text-muted-foreground">
              Start for free, upgrade when you need more. No hidden fees! 😊
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-plan-free">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-muted p-3 rounded-full mb-4 w-fit">
                  <Heart className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl">Free Plan 🆓</CardTitle>
                <div className="text-3xl font-bold">$0<span className="text-lg text-muted-foreground">/month</span></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Track up to 5 products 📦</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Basic email notifications 📧</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Check every 60 minutes ⏰</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Amazon & Walmart support 🛒</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={openSignupModal}
                  data-testid="button-plan-free"
                >
                  Start Free 🚀
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="hover-elevate p-6 border-primary border-2 shadow-xl relative" data-testid="card-plan-pro">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                Most Popular 🌟
              </Badge>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 w-fit">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Pro Plan ⭐</CardTitle>
                <div className="text-3xl font-bold text-primary">
                  $9.99<span className="text-lg text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Track unlimited products 🚀</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Fast alerts (5-minute checks) ⚡</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Priority email notifications 📨</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Price history & analytics 📈</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Desktop app access 💻</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">Premium support 🎧</span>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={openSignupModal}
                  data-testid="button-plan-pro"
                >
                  Upgrade to Pro 💎
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              All plans include a 7-day free trial. Cancel anytime, no questions asked! 😌
            </p>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Download the Desktop App 💻
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get the full experience with our desktop app. Faster notifications, 
              offline access, and a sleek interface! ✨
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-download-windows">
                <CardContent className="text-center space-y-4">
                  <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                    <Monitor className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Windows 🪟</h3>
                  <p className="text-sm text-muted-foreground">
                    True desktop app (Electron source code)
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full px-6 py-3 min-h-12"
                    asChild
                    data-testid="button-download-windows"
                  >
                    <a href="/stock-monitor-electron-with-instructions.tar.gz" download="stock-monitor-electron-with-instructions.tar.gz" className="flex items-center justify-center gap-2">
                      <Download className="h-4 w-4" />
                      Download Source Code
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-download-mac">
                <CardContent className="text-center space-y-4">
                  <div className="mx-auto bg-muted/20 p-3 rounded-full w-fit">
                    <Smartphone className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">macOS 🍎</h3>
                  <p className="text-sm text-muted-foreground">
                    Intel and Apple Silicon support
                  </p>
                  <Button 
                    variant="outline" 
                    disabled 
                    className="w-full px-6 py-3 min-h-12 flex items-center justify-center gap-2"
                    data-testid="button-download-mac"
                  >
                    <Download className="h-4 w-4" />
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-download-linux">
                <CardContent className="text-center space-y-4">
                  <div className="mx-auto bg-chart-1/10 p-3 rounded-full w-fit">
                    <Globe className="h-8 w-8 text-chart-1" />
                  </div>
                  <h3 className="font-semibold text-lg">Linux 🐧</h3>
                  <p className="text-sm text-muted-foreground">
                    Ubuntu, Debian, and more
                  </p>
                  <Button 
                    variant="outline" 
                    disabled 
                    className="w-full px-6 py-3 min-h-12 flex items-center justify-center gap-2"
                    data-testid="button-download-linux"
                  >
                    <Download className="h-4 w-4" />
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200">Security Notice</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Windows may show a security warning</strong> for our unsigned beta software. 
                      This is normal for new applications. The executable has been verified safe by multiple antivirus engines.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gradient-to-r from-primary/5 to-chart-1/5 rounded-lg border">
                <h3 className="font-semibold text-lg mb-2">Meanwhile, try our web demo! 🌐</h3>
                <p className="text-muted-foreground mb-4">
                  Explore our full-featured demo with sample data. 
                  Perfect for testing all features before downloading! 🎯
                </p>
                <Button asChild data-testid="button-try-web-app">
                  <Link href="/dashboard">
                    Try Interactive Demo 🚀
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              What Our Users Say 💬
            </h2>
            <p className="text-xl text-muted-foreground">
              Real feedback from real savings! 🎉
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-testimonial-1">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-chart-2 text-chart-2" />
                  ))}
                </div>
                <p className="text-sm">
                  "Finally caught that gaming chair on sale! Saved $120 thanks to the fast alerts. 
                  The email came within minutes of the price drop! 🎮✨"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">M</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Mike Chen</div>
                    <div className="text-xs text-muted-foreground">Pro User</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-testimonial-2">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-chart-2 text-chart-2" />
                  ))}
                </div>
                <p className="text-sm">
                  "Been using it for 3 months, saved over $300 on household items. 
                  The stock alerts are amazing - no more 'out of stock' disappointments! 🏠💰"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-chart-1/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">S</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Sarah Johnson</div>
                    <div className="text-xs text-muted-foreground">Free User</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate p-6 border-0 shadow-lg" data-testid="card-testimonial-3">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-chart-2 text-chart-2" />
                  ))}
                </div>
                <p className="text-sm">
                  "Love the honest timing - no false promises! The 5-minute checks on Pro plan 
                  are perfect for hot deals. Super reliable! ⏰🔥"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-chart-3/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">A</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Alex Rivera</div>
                    <div className="text-xs text-muted-foreground">Pro User</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Monitor className="h-6 w-6 text-primary" />
                <span className="font-bold text-xl">Stock Monitor</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Never miss a great deal again. Smart price tracking and stock monitoring 
                that actually works! 🎯✨
              </p>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" disabled data-testid="button-social-twitter">
                  🐦 Twitter
                </Button>
                <Button variant="outline" size="sm" disabled data-testid="button-social-discord">
                  💬 Discord  
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Product 📦</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><a href="#features" className="hover:text-foreground transition-colors">Features</a></div>
                <div><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></div>
                <div><a href="#download" className="hover:text-foreground transition-colors">Download</a></div>
                <div><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Support 🎧</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><a href="mailto:support@stockmonitor.app" className="hover:text-foreground transition-colors">Help Center</a></div>
                <div><a href="mailto:support@stockmonitor.app" className="hover:text-foreground transition-colors">Contact Us</a></div>
                <div><a href="#" className="hover:text-foreground transition-colors">Status</a></div>
                <div><a href="#" className="hover:text-foreground transition-colors">Documentation</a></div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Legal ⚖️</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></div>
                <div><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></div>
                <div><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></div>
                <div><a href="#" className="hover:text-foreground transition-colors">Refund Policy</a></div>
              </div>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Stock Monitor. Made with ❤️ for deal hunters everywhere! 🛒✨</p>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthChoiceModal 
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultMode={authModalMode}
      />

      {/* Demo Modal - Desktop Only */}
      <DemoModal 
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
}