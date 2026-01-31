// src/screens/CoinsScreen.jsx - ARVDOUL COINS & MONETIZATION
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';

// Icons
import { 
  Coins, CreditCard, Wallet, Crown, Zap, Rocket, Star, 
  CheckCircle, Shield, Gift, TrendingUp, ArrowLeft,
  Smartphone, Monitor, Watch, Headphones
} from 'lucide-react';

const COIN_PACKAGES = [
  { id: 'basic', coins: 100, price: '$0.99', bonus: 0, popular: false, icon: Coins, color: 'from-amber-500 to-yellow-500' },
  { id: 'pro', coins: 500, price: '$4.99', bonus: 50, popular: true, icon: Crown, color: 'from-purple-500 to-pink-500' },
  { id: 'premium', coins: 1200, price: '$9.99', bonus: 200, popular: false, icon: Star, color: 'from-blue-500 to-cyan-500' },
  { id: 'ultimate', coins: 2500, price: '$19.99', bonus: 500, popular: false, icon: Rocket, color: 'from-orange-500 to-red-500' },
  { id: 'max', coins: 5000, price: '$39.99', bonus: 1500, popular: false, icon: Zap, color: 'from-green-500 to-emerald-500' }
];

export default function CoinsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { coins: userCoins, addCoins } = useAppStore();
  
  const [selectedPackage, setSelectedPackage] = useState('pro');
  
  const colors = theme === 'dark' ? {
    bg: 'bg-gradient-to-b from-gray-900 via-gray-950 to-black',
    card: 'bg-gray-800/90',
    border: 'border-gray-700',
    text: 'text-white',
    secondary: 'text-gray-400'
  } : {
    bg: 'bg-gradient-to-b from-blue-50 via-white to-white',
    card: 'bg-white/95',
    border: 'border-gray-200',
    text: 'text-gray-900',
    secondary: 'text-gray-600'
  };
  
  const handlePurchase = (pkg) => {
    toast.success(
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Purchase Complete!</h3>
            <p className="text-sm opacity-90">+{pkg.coins + pkg.bonus} coins added to your account</p>
          </div>
        </div>
        <p className="text-sm mb-4">This is a demo. In production, integrate with Stripe or PayPal.</p>
        <button
          onClick={() => {
            addCoins(pkg.coins + pkg.bonus);
            toast.dismiss();
          }}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold"
        >
          Simulate Adding {pkg.coins + pkg.bonus} Coins
        </button>
      </div>,
      { duration: 10000 }
    );
  };
  
  return (
    <div className={cn("min-h-screen pb-20", colors.bg)}>
      {/* Header */}
      <div className={cn("sticky top-0 z-50 border-b backdrop-blur-xl", colors.card, colors.border)}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-3 rounded-xl hover:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Arvdoul Coins
              </h1>
              <p className={cn("text-sm", colors.secondary)}>Premium currency for boosts & gifts</p>
            </div>
            
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-amber-500">{userCoins.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-2xl p-6 mb-8", colors.card, colors.border, "border")}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className={cn("text-3xl font-bold mb-2", colors.text)}>Your Coin Balance</h2>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <div className="relative">
                  <Coins className="w-12 h-12 text-amber-500" />
                  <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-sm" />
                </div>
                <div>
                  <div className="text-5xl font-bold text-amber-500">{userCoins.toLocaleString()}</div>
                  <p className={cn("text-lg", colors.secondary)}>Arvdoul Coins</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-xl text-center", colors.card, colors.border, "border")}>
                <div className="text-2xl font-bold text-green-500">+85%</div>
                <div className={cn("text-sm", colors.secondary)}>Creator Earnings</div>
              </div>
              <div className={cn("p-4 rounded-xl text-center", colors.card, colors.border, "border")}>
                <div className="text-2xl font-bold text-purple-500">24/7</div>
                <div className={cn("text-sm", colors.secondary)}>Support</div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Coin Packages */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-2xl font-bold", colors.text)}>Buy Coins</h2>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">Secure Payment</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {COIN_PACKAGES.map((pkg) => {
              const Icon = pkg.icon;
              const isSelected = selectedPackage === pkg.id;
              
              return (
                <motion.div
                  key={pkg.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={cn(
                    "relative rounded-2xl p-6 cursor-pointer transition-all duration-300",
                    "border-2 backdrop-blur-sm",
                    isSelected 
                      ? "border-blue-500 bg-gradient-to-br from-blue-500/10 to-purple-500/10 shadow-xl" 
                      : colors.border,
                    colors.card,
                    "hover:shadow-lg"
                  )}
                >
                  {/* Popular Badge */}
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold">
                        MOST POPULAR
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl mb-4 flex items-center justify-center mx-auto",
                      `bg-gradient-to-br ${pkg.color}`
                    )}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <div className="text-3xl font-bold mb-1">{pkg.coins.toLocaleString()}</div>
                    <div className={cn("text-sm mb-2", colors.secondary)}>Coins</div>
                    
                    {pkg.bonus > 0 && (
                      <div className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-500 text-sm font-bold">
                        +{pkg.bonus} Bonus
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-4">{pkg.price}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePurchase(pkg);
                      }}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold transition-all duration-300",
                        isSelected
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
                          : "bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-200 hover:opacity-90"
                      )}
                    >
                      {isSelected ? 'SELECTED' : 'BUY NOW'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        
        {/* Features */}
        <div className={cn("rounded-2xl p-8", colors.card, colors.border, "border")}>
          <h2 className={cn("text-2xl font-bold mb-8 text-center", colors.text)}>What Can You Do With Coins?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-3", colors.text)}>Boost Posts</h3>
              <p className={colors.secondary}>Increase your reach and get more engagement on your content</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-3", colors.text)}>Send Gifts</h3>
              <p className={colors.secondary}>Support your favorite creators with virtual gifts</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-3", colors.text)}>Premium Features</h3>
              <p className={colors.secondary}>Unlock exclusive features and monetization options</p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Bottom Bar */}
      <div className={cn("fixed bottom-0 left-0 right-0 border-t backdrop-blur-xl", colors.card, colors.border)}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className={cn("text-sm", colors.secondary)}>Secure payment • Instant delivery • 24/7 support</span>
            </div>
            
            <button
              onClick={() => navigate('/create-post')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold hover:from-amber-600 hover:to-yellow-600 transition-all"
            >
              Create Post with Coins
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}