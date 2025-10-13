import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, X } from "lucide-react";

export interface TokenTransaction {
  mint: string;
  symbol: string;
  amount: number;
  usdValue: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  signature?: string;
}

interface DonationProgressProps {
  transactions: TokenTransaction[];
  currentIndex: number;
  totalValue: number;
}

export function DonationProgress({ transactions, currentIndex, totalValue }: DonationProgressProps) {
  const progress = transactions.length > 0 ? ((currentIndex + 1) / transactions.length) * 100 : 0;
  const completedValue = transactions
    .slice(0, currentIndex + 1)
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + t.usdValue, 0);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-lg border-border/50">
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Donation Progress</span>
            <span className="text-sm font-medium text-primary">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Value:</span>
          <span className="font-semibold text-foreground">${totalValue.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Donated:</span>
          <span className="font-semibold text-primary">${completedValue.toFixed(2)}</span>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {transactions.map((tx, index) => (
            <div
              key={tx.mint}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                index === currentIndex
                  ? 'border-primary bg-primary/10'
                  : tx.status === 'success'
                  ? 'border-accent/30 bg-accent/5'
                  : 'border-border/30 bg-card/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {tx.status === 'processing' && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
                {tx.status === 'success' && (
                  <Check className="w-4 h-4 text-accent" />
                )}
                {tx.status === 'failed' && (
                  <X className="w-4 h-4 text-destructive" />
                )}
                {tx.status === 'pending' && (
                  <div className="w-4 h-4 rounded-full border-2 border-muted" />
                )}
                <div>
                  <p className="font-medium text-foreground">{tx.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.amount.toFixed(4)} • ${tx.usdValue.toFixed(2)}
                  </p>
                </div>
              </div>

              {tx.status === 'processing' && (
                <span className="text-xs text-primary font-medium">Signing...</span>
              )}
              {tx.status === 'success' && (
                <span className="text-xs text-accent font-medium">Sent</span>
              )}
              {tx.status === 'failed' && (
                <span className="text-xs text-destructive font-medium">Failed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
