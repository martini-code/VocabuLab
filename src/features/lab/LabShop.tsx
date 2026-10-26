import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Lock, Sparkles, Trophy } from 'lucide-react-native';
import { colors } from '../../theme';
import { LAB_ITEMS, LAB_ITEM_IDS, LabItemId } from './catalog';
import { ItemArt } from './itemArt';
import { buyItem, LabState, TrophyProgress, trophyEarned } from './labStore';

interface LabShopProps {
  lab: LabState;
  progress: TrophyProgress;
  onChange: (next: LabState) => void;
  onClose: () => void;
}

type ShopTab = 'shop' | 'trophies';

export const LabShop: React.FC<LabShopProps> = ({ lab, progress, onChange, onClose }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ShopTab>('shop');
  const [message, setMessage] = useState<string | null>(null);
  const name = (id: LabItemId) => t(`lab.items.${id}`, { defaultValue: LAB_ITEMS[id].name });

  const shopIds = LAB_ITEM_IDS.filter((id) => LAB_ITEMS[id].source === 'shop').sort(
    (a, b) => (LAB_ITEMS[a].price ?? 0) - (LAB_ITEMS[b].price ?? 0)
  );
  const trophyIds = LAB_ITEM_IDS.filter((id) => LAB_ITEMS[id].source === 'trophy');

  const buy = (id: LabItemId) => {
    const result = buyItem(lab, id);
    if (result.ok) {
      onChange(result.state);
      setMessage(
        result.state.layout[id]
          ? t('lab.shop_bought_placed', {
              defaultValue: '{{item}} is in your lab!',
              item: name(id),
            })
          : t('lab.shop_bought_stored', {
              defaultValue: '{{item}} is in storage. Make room in Decorate.',
              item: name(id),
            })
      );
    } else if (result.reason === 'too_expensive') {
      setMessage(t('lab.shop_need_sparks', { defaultValue: 'Review more cards to earn Sparks.' }));
    }
  };

  const trophyRule = (id: LabItemId) => {
    const rule = LAB_ITEMS[id].trophy;
    if (!rule) return '';
    if (rule.kind === 'streak') {
      return t('lab.trophy_streak', {
        defaultValue: 'Reach a {{days}}-day streak',
        days: rule.days,
      });
    }
    if (rule.kind === 'learned') {
      return t('lab.trophy_learned', { defaultValue: 'Learn {{count}} words', count: rule.cards });
    }
    return t('lab.trophy_mastered', { defaultValue: 'Master {{count}} words', count: rule.cards });
  };

  return (
    <View style={styles.container} testID="lab-shop-screen">
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('lab.back', { defaultValue: 'Back to the lab' })}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.neutral[800]} />
        </Pressable>
        <Text style={styles.title}>{t('lab.shop_title', { defaultValue: 'Lab shop' })}</Text>
        <View
          style={styles.sparks}
          accessible
          accessibilityLabel={t('lab.sparks_a11y', {
            defaultValue: '{{count}} Sparks',
            count: lab.sparks,
          })}
        >
          <Sparkles size={16} color={colors.primary[700]} />
          <Text style={styles.sparksText}>{lab.sparks}</Text>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['shop', 'trophies'] as ShopTab[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => {
              setTab(key);
              setMessage(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'shop'
                ? t('lab.tab_shop', { defaultValue: 'Furniture' })
                : t('lab.tab_trophies', { defaultValue: 'Earned by learning' })}
            </Text>
          </Pressable>
        ))}
      </View>

      {message && <Text style={styles.message}>{message}</Text>}

      <ScrollView contentContainerStyle={styles.grid}>
        {tab === 'shop' &&
          shopIds.map((id) => {
            const item = LAB_ITEMS[id];
            const owned = lab.owned.includes(id);
            const affordable = lab.sparks >= (item.price ?? 0);
            return (
              <View key={id} style={styles.card}>
                <View style={styles.art}>
                  <ItemArt id={id} width={120} height={80} />
                </View>
                <Text style={styles.cardName}>{name(id)}</Text>
                <Text style={styles.cardMeta}>
                  {item.w}×{item.h} ·{' '}
                  {item.zone === 'wall'
                    ? t('lab.arrange.wall', { defaultValue: 'Wall' })
                    : t('lab.arrange.floor', { defaultValue: 'Floor' })}
                </Text>
                <Pressable
                  onPress={() => buy(id)}
                  disabled={owned}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: owned }}
                  style={[
                    styles.buy,
                    owned && styles.buyOwned,
                    !owned && !affordable && styles.buyShort,
                  ]}
                >
                  {!owned && (
                    <Sparkles
                      size={14}
                      color={affordable ? colors.neutral[0] : colors.neutral[600]}
                    />
                  )}
                  <Text
                    style={[
                      styles.buyText,
                      owned && styles.buyTextOwned,
                      !owned && !affordable && styles.buyTextShort,
                    ]}
                  >
                    {owned ? t('lab.owned', { defaultValue: 'Owned' }) : item.price}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        {tab === 'trophies' &&
          trophyIds.map((id) => {
            const earned = lab.owned.includes(id) || trophyEarned(id, progress);
            return (
              <View key={id} style={[styles.card, earned && styles.cardEarned]}>
                <View style={[styles.art, !earned && styles.artLocked]}>
                  <ItemArt id={id} width={120} height={80} />
                </View>
                <Text style={styles.cardName}>{name(id)}</Text>
                <View style={styles.rule}>
                  {earned ? (
                    <Trophy size={14} color={colors.success[700]} />
                  ) : (
                    <Lock size={14} color={colors.neutral[500]} />
                  )}
                  <Text style={[styles.cardMeta, earned && styles.earnedText]}>
                    {earned ? t('lab.trophy_earned', { defaultValue: 'Earned' }) : trophyRule(id)}
                  </Text>
                </View>
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: colors.neutral[900] },
  sparks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  sparksText: { fontSize: 15, fontWeight: '900', color: colors.neutral[900] },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  tabActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[700] },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.neutral[700] },
  tabTextActive: { color: colors.neutral[0] },
  message: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.primary[100],
    color: colors.primary[800],
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    width: '48%',
    borderRadius: 18,
    padding: 10,
    gap: 4,
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.neutral[200],
  },
  cardEarned: { borderColor: colors.success[200], backgroundColor: colors.success[50] },
  art: {
    height: 88,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  artLocked: { opacity: 0.35 },
  cardName: { fontSize: 14, fontWeight: '800', color: colors.neutral[900] },
  cardMeta: { fontSize: 12, fontWeight: '600', color: colors.neutral[600] },
  earnedText: { color: colors.success[700], fontWeight: '800' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buy: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary[500],
    borderBottomWidth: 3,
    borderBottomColor: colors.primary[700],
  },
  buyOwned: { backgroundColor: colors.neutral[100], borderBottomColor: colors.neutral[200] },
  buyShort: { backgroundColor: colors.neutral[100], borderBottomColor: colors.neutral[300] },
  buyText: { fontSize: 14, fontWeight: '900', color: colors.neutral[0] },
  buyTextOwned: { color: colors.neutral[600] },
  buyTextShort: { color: colors.neutral[600] },
});
