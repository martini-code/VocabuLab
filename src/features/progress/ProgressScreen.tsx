import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getProgressOverview } from '../../db/vault';
import { ProgressOverview, ActivityDay } from '../../types';
import { LabMascot } from '../../components/mascot/Mascots';
import { LabCard } from '../../components/ui/LabCard';

const LEVEL_COLORS: Record<number, { bg: string; border: string }> = {
  0: { bg: '#E2E8F0', border: '#CBD5E1' }, // 0 reviews
  1: { bg: '#86EFAC', border: '#4ADE80' }, // 1-3 reviews
  2: { bg: '#4ADE80', border: '#22C55E' }, // 4-7 reviews
  3: { bg: '#16A34A', border: '#15803D' }, // 8-14 reviews
  4: { bg: '#14532D', border: '#052E16' }, // 15+ reviews
};

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export const ProgressScreen: React.FC = () => {
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<ActivityDay | null>(null);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    setLoading(true);
    const overview = await getProgressOverview(18);
    setData(overview);

    // Default selected day to today
    const todayStr = new Date().toISOString().split('T')[0];
    let foundToday: ActivityDay | null = null;
    for (const week of overview.gridWeeks) {
      for (const day of week.days) {
        if (day && day.date === todayStr) {
          foundToday = day;
          break;
        }
      }
      if (foundToday) break;
    }
    setSelectedDay(foundToday || { date: todayStr, count: overview.todayReviews, level: overview.todayReviews > 0 ? 1 : 0 });
    setLoading(false);
  };

  if (loading || !data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Opening the lab notebook...</Text>
      </View>
    );
  }

  // Format date nicely: "Wednesday, Sep 9, 2026"
  const formatDateTitle = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Find max day count for weekly bar scaling
  const maxWeeklyCount = Math.max(...data.weeklyDistribution.map((d) => d.count), 1);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>LAB NOTEBOOK</Text>
        <Text style={styles.subtitle}>Daily study contributions and experiment log</Text>
      </View>

      {/* Mascot & Streak Banner */}
      <View style={styles.mascotBanner}>
        <LabMascot mood={data.currentStreak >= 3 ? 'happy' : 'idle'} size={85} />
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>
            {data.currentStreak >= 4
              ? `Outstanding discipline, scientist! A ${data.currentStreak}-day study streak keeps your results reproducible.`
              : 'Every single card reviewed adds another data point. Keep the Bunsen burner lit!'}
          </Text>
          <View style={styles.speechTail} />
        </View>
      </View>

      {/* Streak Stats Grid */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.currentStreak} Days</Text>
          <Text style={styles.statLabel}>CURRENT STREAK</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.longestStreak} Days</Text>
          <Text style={styles.statLabel}>LONGEST STREAK</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.totalReviews}</Text>
          <Text style={styles.statLabel}>CARD REVIEWS</Text>
        </View>
      </View>

      {/* GitHub-Style Activity Contribution Heat-Map */}
      <LabCard style={styles.matrixCard}>
        <View style={styles.matrixHeader}>
          <Text style={styles.sectionTitle}>STUDY ACTIVITY GRAPH</Text>
          <Text style={styles.sectionSub}>{data.totalReviews} total contributions in the lab notebook</Text>
        </View>

        {/* Month Headers & Grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
          <View style={styles.gridContainer}>
            {/* Month Labels Bar */}
            <View style={styles.monthLabelsRow}>
              <View style={styles.dayLabelSpacer} />
              {data.gridWeeks.map((_, weekIdx) => {
                const monthMatch = data.monthLabels.find((m) => m.weekIndex === weekIdx);
                return (
                  <View key={`month-${weekIdx}`} style={styles.monthHeaderCell}>
                    {monthMatch ? (
                      <Text style={styles.monthLabelText}>{monthMatch.label}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* 7-Row Grid with Day Labels */}
            <View style={styles.matrixBody}>
              {/* Day Labels Column (Mon, Wed, Fri) */}
              <View style={styles.dayLabelsCol}>
                {DAY_LABELS.map((lbl, rowIdx) => (
                  <View key={`lbl-${rowIdx}`} style={styles.dayLabelCell}>
                    <Text style={styles.dayLabelText}>{lbl}</Text>
                  </View>
                ))}
              </View>

              {/* Columns of Weeks */}
              {data.gridWeeks.map((week, weekIdx) => (
                <View key={`week-${weekIdx}`} style={styles.weekColumn}>
                  {week.days.map((day, dayIdx) => {
                    if (!day) {
                      // Future day in the week
                      return <View key={`blank-${dayIdx}`} style={styles.blankCell} />;
                    }

                    const palette = LEVEL_COLORS[day.level];
                    const isSelected = selectedDay?.date === day.date;

                    return (
                      <TouchableOpacity
                        key={day.date}
                        activeOpacity={0.7}
                        onPress={() => setSelectedDay(day)}
                        style={[
                          styles.dayCell,
                          {
                            backgroundColor: palette.bg,
                            borderColor: isSelected ? '#1E293B' : palette.border,
                            borderWidth: isSelected ? 2 : 1,
                            transform: [{ scale: isSelected ? 1.15 : 1 }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Legend */}
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>Less</Text>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <View
              key={`legend-${lvl}`}
              style={[
                styles.legendCell,
                {
                  backgroundColor: LEVEL_COLORS[lvl].bg,
                  borderColor: LEVEL_COLORS[lvl].border,
                },
              ]}
            />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>

        {/* Selected Day Inspector */}
        {selectedDay && (
          <View style={styles.inspectorBox}>
            <View style={styles.inspectorTop}>
              <Text style={styles.inspectorDate}>{formatDateTitle(selectedDay.date)}</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: LEVEL_COLORS[selectedDay.level].bg,
                    borderColor: LEVEL_COLORS[selectedDay.level].border,
                  },
                ]}
              >
                <Text style={styles.badgeText}>
                  {selectedDay.count > 0 ? `${selectedDay.count} Reviews` : 'Rest Day'}
                </Text>
              </View>
            </View>
            <Text style={styles.inspectorMessage}>
              {selectedDay.count >= 15
                ? 'Breakthrough day! The lab notebook recorded massive progress.'
                : selectedDay.count >= 8
                ? 'Heroic study session with multiple cards reviewed and reinforced.'
                : selectedDay.count >= 1
                ? 'Solid experiment logged in the local lab notebook.'
                : 'No experiments recorded on this calendar day.'}
            </Text>
          </View>
        )}
      </LabCard>

      {/* Day of Week Distribution Chart */}
      <LabCard style={styles.distributionCard}>
        <Text style={styles.sectionTitle}>WEEKLY EXPERIMENT VOLUME</Text>
        <Text style={styles.sectionSub}>Review distribution across days of the week</Text>

        <View style={styles.chartContainer}>
          {data.weeklyDistribution.map((item) => {
            const heightPercent = Math.max(12, (item.count / maxWeeklyCount) * 100);

            return (
              <View key={item.day} style={styles.barColumn}>
                <Text style={styles.barCount}>{item.count}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                </View>
                <Text style={styles.barDay}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </LabCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#78350F',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  mascotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  speechBubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    marginLeft: 10,
    position: 'relative',
  },
  speechText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 18,
  },
  speechTail: {
    position: 'absolute',
    left: -8,
    top: 20,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderTopColor: 'transparent',
    borderBottomWidth: 7,
    borderBottomColor: 'transparent',
    borderRightWidth: 8,
    borderRightColor: '#CBD5E1',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  matrixCard: {
    marginBottom: 16,
    padding: 16,
  },
  matrixHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  gridScroll: {
    paddingVertical: 6,
  },
  gridContainer: {
    flexDirection: 'column',
  },
  monthLabelsRow: {
    flexDirection: 'row',
    height: 18,
    marginBottom: 4,
  },
  dayLabelSpacer: {
    width: 28,
  },
  monthHeaderCell: {
    width: 17,
    marginRight: 3,
    justifyContent: 'flex-end',
  },
  monthLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  matrixBody: {
    flexDirection: 'row',
  },
  dayLabelsCol: {
    width: 28,
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  dayLabelCell: {
    height: 14,
    marginBottom: 3,
    justifyContent: 'center',
  },
  dayLabelText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  weekColumn: {
    flexDirection: 'column',
    marginRight: 3,
  },
  dayCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginBottom: 3,
  },
  blankCell: {
    width: 14,
    height: 14,
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginHorizontal: 4,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 2.5,
    borderWidth: 1,
  },
  inspectorBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 14,
  },
  inspectorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inspectorDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  inspectorMessage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 16,
    marginTop: 2,
  },
  distributionCard: {
    padding: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    marginTop: 16,
    paddingTop: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: '#10B981',
    borderRadius: 7,
    width: '100%',
  },
  barDay: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 6,
  },
});
