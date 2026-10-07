import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Coins } from 'lucide-react-native';
import { tokenWallet, TokenWalletState } from '../../services/tokenWallet';

interface TokenPillProps {
  onPress: () => void;
  testID?: string;
}

/**
 * Isolated Token Allowance Pill component.
 * Subscribes to tokenWallet updates internally so wallet state changes
 * only re-render this pill rather than the entire App tree.
 */
export const TokenPill: React.FC<TokenPillProps> = React.memo(
  ({ onPress, testID = 'token-pill-btn' }) => {
    const [wallet, setWallet] = useState<TokenWalletState | null>(null);

    useEffect(() => {
      tokenWallet.getWalletStatus().then(setWallet);
      const unsub = tokenWallet.subscribe(setWallet);
      return unsub;
    }, []);

    const allowance = wallet ? wallet.totalWordsAllowance : 0;

    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.statPill,
          styles.tokenPill,
          {
            transform: [{ translateY: pressed ? 1 : 0 }],
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Coins size={16} color="#D97706" />
        <Text style={styles.tokenPillText}>{allowance}</Text>
      </Pressable>
    );
  }
);
TokenPill.displayName = 'TokenPill';

const styles = StyleSheet.create({
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  tokenPill: {
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
    gap: 4,
  },
  tokenPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B45309',
  },
});
