import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { initVault, getVaultStats } from './src/db/vault';
import { syncDatabaseFromR2 } from './src/db/downloader';
import { initPurchases, isLocalProActive } from './src/services/purchases';
import { VaultStats } from './src/types';
import { ReviewSession } from './src/features/pipeline/ReviewSession';
import { DomainBrowser } from './src/features/archives/DomainBrowser';
import { FastSearch } from './src/features/search/FastSearch';
import { PaywallModal } from './src/features/paywall/PaywallModal';
import { SquireMascot } from './src/components/mascot/Mascots';

type TabType = 'pipeline' | 'archives' | 'search' | 'treasury';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('pipeline');
  const [isVaultReady, setIsVaultReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Opening the fortress gates...');
  const [stats, setStats] = useState<VaultStats>({
    totalCards: 0,
    dueCards: 0,
    newCards: 0,
    masteredCards: 0,
    streakDays: 4,
    xpPoints: 240,
  });
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    bootstrapKeep();
  }, []);

  const bootstrapKeep = async () => {
    try {
      setStatusMessage('Checking kingdom scrolls...');
      await syncDatabaseFromR2();

      setStatusMessage('Inscribing SQLite vault with WAL mode & FTS5...');
      await initVault();

      setStatusMessage('Consulting the Royal Guild...');
      await initPurchases();
      setIsPro(isLocalProActive());

      const currentStats = await getVaultStats();
      setStats(currentStats);

      setIsVaultReady(true);
    } catch (error) {
      console.error('[VocabKeep] Bootstrap error:', error);
      setIsVaultReady(true);
    }
  };

  const refreshStats = async () => {
    try {
      const currentStats = await getVaultStats();
      setStats(currentStats);
      setIsPro(isLocalProActive());
    } catch (error) {
      // Ignore
    }
  };

  if (!isVaultReady) {
    return (
      <View style={styles.splashContainer}>
        <SquireMascot mood="idle" size={130} />
        <Text style={styles.splashTitle}>VOCAB KEEP</Text>
        <Text style={styles.splashTagline}>The Medieval Fortress of Spaced Memory</Text>
        <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 24 }} />
        <Text style={styles.splashStatus}>{statusMessage}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FEFCE8" />

      {/* Top Medieval Stats Header */}
      <View style={styles.topStatsBar}>
        {/* Streak Flame */}
        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{stats.streakDays}</Text>
        </View>

        {/* Due Cards Shield */}
        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>🛡️</Text>
          <Text style={styles.statValue}>{stats.dueCards} Due</Text>
        </View>

        {/* Valor Points XP */}
        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={styles.statValue}>{stats.xpPoints} XP</Text>
        </View>

        {/* Crown Guild Pass Button */}
        <TouchableOpacity
          style={[styles.statPill, isPro ? styles.proPillActive : styles.proPill]}
          onPress={() => setPaywallOpen(true)}
        >
          <Text style={styles.statEmoji}>👑</Text>
          <Text style={[styles.statValue, isPro ? styles.proTextActive : styles.proText]}>
            {isPro ? 'ROYAL' : 'PASS'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main View Area */}
      <View style={styles.contentArea}>
        {activeTab === 'pipeline' && (
          <ReviewSession
            onSessionComplete={refreshStats}
            onExploreArchives={() => setActiveTab('archives')}
          />
        )}
        {activeTab === 'archives' && (
          <DomainBrowser
            onOpenPaywall={() => setPaywallOpen(true)}
            onStartTraining={() => {
              refreshStats();
              setActiveTab('pipeline');
            }}
          />
        )}
        {activeTab === 'search' && <FastSearch />}
        {activeTab === 'treasury' && (
          <View style={styles.treasuryTabContainer}>
            <SquireMascot mood="victorious" size={120} />
            <Text style={styles.treasuryTitle}>THE ROYAL TREASURY</Text>
            <Text style={styles.treasurySub}>Zero Cloud Overhead • 100% Local Fortress</Text>

            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Garrisoned Cards:</Text>
                <Text style={styles.statNumber}>{stats.totalCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pending Reviews (Due):</Text>
                <Text style={styles.statNumber}>{stats.dueCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Mastered Scrolls (S≥10):</Text>
                <Text style={styles.statNumber}>{stats.masteredCards}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Database Engine:</Text>
                <Text style={styles.statHighlight}>SQLite WAL + FTS5</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Spaced Repetition Algorithm:</Text>
                <Text style={styles.statHighlight}>ts-fsrs v4.2</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Cloud Infrastructure Cost:</Text>
                <Text style={styles.statFree}>$0.00 / mo</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.treasuryActionBtn}
              onPress={() => setPaywallOpen(true)}
            >
              <Text style={styles.treasuryActionText}>
                {isPro ? '👑 ROYAL GUILD PRIVILEGES ACTIVE' : '🗝️ VIEW GUILD PASS OPTIONS'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Medieval Cartoon Bottom Tab Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            refreshStats();
            setActiveTab('pipeline');
          }}
          style={[styles.navItem, activeTab === 'pipeline' && styles.navItemActive]}
        >
          <Text style={styles.navEmoji}>⚔️</Text>
          <Text style={[styles.navLabel, activeTab === 'pipeline' && styles.navLabelActive]}>
            Training
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            refreshStats();
            setActiveTab('archives');
          }}
          style={[styles.navItem, activeTab === 'archives' && styles.navItemActive]}
        >
          <Text style={styles.navEmoji}>🏰</Text>
          <Text style={[styles.navLabel, activeTab === 'archives' && styles.navLabelActive]}>
            Archives
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            refreshStats();
            setActiveTab('search');
          }}
          style={[styles.navItem, activeTab === 'search' && styles.navItemActive]}
        >
          <Text style={styles.navEmoji}>📜</Text>
          <Text style={[styles.navLabel, activeTab === 'search' && styles.navLabelActive]}>
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            refreshStats();
            setActiveTab('treasury');
          }}
          style={[styles.navItem, activeTab === 'treasury' && styles.navItemActive]}
        >
          <Text style={styles.navEmoji}>🪙</Text>
          <Text style={[styles.navLabel, activeTab === 'treasury' && styles.navLabelActive]}>
            Treasury
          </Text>
        </TouchableOpacity>
      </View>

      {/* Royal Paywall Modal */}
      <PaywallModal
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onSuccess={() => {
          setIsPro(true);
          refreshStats();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FEFCE8',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#78350F',
    marginTop: 18,
    letterSpacing: 1,
  },
  splashTagline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 4,
  },
  splashStatus: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 14,
    fontWeight: '600',
  },
  topStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
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
  proPill: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  proPillActive: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  statEmoji: {
    fontSize: 14,
    marginRight: 5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
  },
  proText: {
    color: '#B45309',
  },
  proTextActive: {
    color: '#047857',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderColor: '#E2E8F0',
    paddingBottom: 8,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navItemActive: {
    borderTopWidth: 3,
    borderTopColor: '#F59E0B',
    marginTop: -3,
  },
  navEmoji: {
    fontSize: 22,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#B45309',
  },
  treasuryTabContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
  },
  treasuryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  treasurySub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
  },
  statHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2563EB',
  },
  statFree: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10B981',
  },
  treasuryActionBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  treasuryActionText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.5,
  },
});
