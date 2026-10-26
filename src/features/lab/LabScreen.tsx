import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Armchair, ShoppingBag } from 'lucide-react-native';
import { ChunkyButton } from '../../components/ui/ChunkyButton';
import { MascotMood } from '../../types';
import { colors } from '../../theme';
import { LAB_ITEMS, LabItemId } from './catalog';
import { drawOrder } from './grid';
import { ItemArt } from './itemArt';
import { LexActor } from './LexActor';
import {
  chooseSpot,
  decideState,
  modeForState,
  NUDGE_SUGGESTION_MS,
  RELAX_ROTATION_MS,
  spotForSuggestion,
  Suggestion,
  SUGGESTION_MS,
} from './lexBrain';
import { LabState, loadLabState, localDate, saveLabState, unlockTrophies } from './labStore';
import { itemDepth, itemRect, lexPlacement, roomGeometry } from './roomGeometry';
import { RoomBackdrop } from './RoomBackdrop';
import { ArrangeMode } from './ArrangeMode';
import { LabShop } from './LabShop';

interface LabScreenProps {
  dueCards: number;
  streakDays: number;
  learnedCards: number;
  masteredCards: number;
  onStartReview: () => void;
  /** Bump to reload the saved lab (for example after a review session earned Sparks). */
  refreshKey?: number;
}

type LabView = 'room' | 'arrange' | 'shop';

interface Toast {
  kind: 'trophy' | 'favorite' | 'unfavorite';
  item: LabItemId | null;
  until: number;
}

const TICK_MS = 2000;
const TOAST_MS = 4000;
const REACTION_MS = 2500;

export const LabScreen: React.FC<LabScreenProps> = ({
  dueCards,
  streakDays,
  learnedCards,
  masteredCards,
  onStartReview,
  refreshKey = 0,
}) => {
  const { t } = useTranslation();
  const [lab, setLab] = useState<LabState | null>(null);
  const [view, setView] = useState<LabView>('room');
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [reactionUntil, setReactionUntil] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const itemName = useCallback(
    (id: LabItemId) => t(`lab.items.${id}`, { defaultValue: LAB_ITEMS[id].name }),
    [t]
  );

  const updateLab = useCallback((next: LabState) => {
    setLab(next);
    saveLabState(next).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLabState().then((saved) => {
      if (cancelled) return;
      const { state, unlocked } = unlockTrophies(saved, {
        streakDays,
        learnedCards,
        masteredCards,
      });
      setLab(state);
      if (unlocked.length > 0) {
        saveLabState(state).catch(() => {});
        setToast({ kind: 'trophy', item: unlocked[0], until: Date.now() + TOAST_MS * 2 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, streakDays, learnedCards, masteredCards]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const onRoomLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const lexState = useMemo(
    () =>
      decideState({
        dueCards,
        streakDays,
        studiedToday: lab?.lastStudyDate === localDate(now),
        hour: new Date(now).getHours(),
        now,
        eurekaUntil: lab?.eurekaUntil,
      }),
    [dueCards, streakDays, lab, now]
  );
  const mode = modeForState(lexState);

  if (!lab) return <View style={styles.container} />;

  if (view === 'arrange') {
    return (
      <ArrangeMode
        lab={lab}
        onChange={updateLab}
        onDone={() => setView('room')}
        onOpenShop={() => setView('shop')}
      />
    );
  }
  if (view === 'shop') {
    return (
      <LabShop
        lab={lab}
        progress={{ streakDays, learnedCards, masteredCards }}
        onChange={updateLab}
        onClose={() => setView('room')}
      />
    );
  }

  const choice = chooseSpot({
    layout: lab.layout,
    mode,
    now,
    favorite: lab.favorite,
    suggestion,
    rotation: Math.floor(now / RELAX_ROTATION_MS),
  });

  const reacting = now < reactionUntil;
  const asleep = lexState === 'doze' || choice.spot.action === 'nap';
  let mood: MascotMood = mode === 'study' ? 'thinking' : 'happy';
  if (lexState === 'eureka') mood = 'victorious';
  if (lexState === 'doze') mood = 'idle';
  if (choice.nudge) mood = 'confused';
  if (reacting) mood = 'cheering';

  // Speech bubble: a short toast wins, then a reaction, then a tapped item, then Lex's state.
  let bubble = '';
  let showReview = false;
  const count = dueCards;
  if (toast && now < toast.until) {
    const name = toast.item ? itemName(toast.item) : '';
    if (toast.kind === 'trophy') {
      bubble = t('lab.bubble.trophy', {
        defaultValue: 'I earned a {{item}} for our studies!',
        item: name,
      });
    } else if (toast.kind === 'favorite') {
      bubble = t('lab.bubble.favorite', {
        defaultValue: 'The {{item}} is my favorite spot now!',
        item: name.toLowerCase(),
      });
    } else {
      bubble = t('lab.bubble.unfavorite', { defaultValue: 'Okay, no favorite spot.' });
    }
  } else if (reacting) {
    bubble = t('lab.bubble.hi', { defaultValue: 'Hi there! We are all caught up.' });
  } else if (choice.suggested && choice.itemId) {
    const name = itemName(choice.itemId);
    if (LAB_ITEMS[choice.itemId].spots.length === 0) {
      bubble = t('lab.bubble.admire', { defaultValue: 'Nice {{item}}!', item: name });
    } else if (choice.nudge) {
      bubble = t('lab.bubble.nudge', {
        defaultValue: 'Just for a bit… we still have {{count}} cards!',
        count,
      });
    } else if (mode === 'study' && dueCards > 0) {
      bubble = t('lab.bubble.study_spot', {
        defaultValue: 'The {{item}} is ready. Shall we?',
        item: name.toLowerCase(),
      });
      showReview = true;
    } else {
      bubble = t('lab.bubble.relax_spot', { defaultValue: 'Ahh, this is nice.' });
    }
  } else if (lexState === 'eureka') {
    bubble = t('lab.bubble.eureka', {
      defaultValue: 'Session complete! +{{sparks}} Sparks',
      sparks: lab.lastSessionSparks,
    });
  } else if (lexState === 'doze') {
    bubble = t('lab.bubble.doze', {
      defaultValue: 'Zzz… tap me to keep your {{days}}-day streak!',
      days: streakDays,
    });
  } else if (lexState === 'study') {
    bubble = t('lab.bubble.due', {
      defaultValue: '{{count}} words due. Help me review?',
      count,
    });
    showReview = true;
  } else {
    bubble = t('lab.bubble.relax', {
      defaultValue: 'All caught up! Tap something and I will use it.',
    });
  }

  const suggestItem = (id: LabItemId) => {
    const spot = spotForSuggestion(id, mode);
    const short = mode === 'study' && spot.mode === 'relax';
    setReactionUntil(0);
    setToast(null);
    setSuggestion({
      itemId: id,
      until: now + (short ? NUDGE_SUGGESTION_MS : SUGGESTION_MS),
    });
  };

  const toggleFavorite = (id: LabItemId) => {
    const favorite = lab.favorite === id ? null : id;
    updateLab({ ...lab, favorite });
    setToast({ kind: favorite ? 'favorite' : 'unfavorite', item: id, until: now + TOAST_MS });
  };

  const pressLex = () => {
    if (dueCards > 0) {
      onStartReview();
      return;
    }
    setSuggestion(null);
    setReactionUntil(now + REACTION_MS);
  };

  const g = size ? roomGeometry(size.width, size.height) : null;
  const lex = g ? lexPlacement(g, lab.layout, choice) : null;
  const bubbleWidth = 210;
  const bubbleLeft =
    g && lex ? Math.max(8, Math.min(lex.x - bubbleWidth / 2 + 30, g.width - bubbleWidth - 8)) : 0;
  const bubbleBottom = g && lex ? g.height - (lex.bottom - lex.size * 0.92) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.room} onLayout={onRoomLayout} testID="lab-room">
        {g && lex && (
          <>
            <RoomBackdrop g={g} />
            {drawOrder(lab.layout).map((id) => {
              const pos = lab.layout[id];
              if (!pos) return null;
              const rect = itemRect(g, id, pos.c, pos.r);
              const pad = (LAB_ITEMS[id].pad * g.cell) / 84;
              return (
                <Pressable
                  key={id}
                  onPress={() => suggestItem(id)}
                  onLongPress={() => toggleFavorite(id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('lab.a11y.item', {
                    defaultValue:
                      '{{item}}. Tap to send Lex here, long press to make it his favorite spot.',
                    item: itemName(id),
                  })}
                  style={[
                    styles.item,
                    {
                      left: rect.x,
                      top: rect.y,
                      width: rect.w,
                      height: rect.h,
                      padding: pad,
                      zIndex: itemDepth(lab.layout, id),
                    },
                  ]}
                >
                  <ItemArt id={id} width={rect.w - pad * 2} height={rect.h - pad * 2} />
                </Pressable>
              );
            })}
            <LexActor
              x={lex.x}
              bottom={lex.bottom}
              size={lex.size}
              zIndex={lex.zIndex}
              pose={choice.spot.pose}
              action={choice.spot.action}
              mood={mood}
              asleep={asleep}
              onPress={pressLex}
              accessibilityLabel={
                dueCards > 0
                  ? t('lab.a11y.lex_review', { defaultValue: 'Lex. Tap to start reviewing.' })
                  : t('lab.a11y.lex', { defaultValue: 'Lex. Tap to say hi.' })
              }
            />
            {bubble !== '' && (
              <View
                style={[
                  styles.bubble,
                  { left: bubbleLeft, bottom: bubbleBottom, width: bubbleWidth },
                ]}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.bubbleText}>{bubble}</Text>
                {showReview && (
                  <Pressable
                    onPress={onStartReview}
                    accessibilityRole="button"
                    style={styles.bubbleButton}
                  >
                    <Text style={styles.bubbleButtonText}>
                      {t('lab.review', { defaultValue: 'Review' })}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.actions}>
        <ChunkyButton
          title={t('lab.review', { defaultValue: 'Review' })}
          onPress={onStartReview}
          testID="lab-review"
        />
        <View style={styles.actionRow}>
          <ChunkyButton
            title={t('lab.decorate', { defaultValue: 'Decorate' })}
            color="secondary"
            icon={<Armchair size={18} color={colors.primary[800]} />}
            onPress={() => setView('arrange')}
            style={styles.half}
            testID="lab-decorate"
          />
          <ChunkyButton
            title={t('lab.shop', { defaultValue: 'Shop' })}
            color="ink"
            icon={<ShoppingBag size={18} color={colors.neutral[0]} />}
            onPress={() => setView('shop')}
            style={styles.half}
            testID="lab-shop"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary[50] },
  room: { flex: 1, overflow: 'hidden' },
  item: { position: 'absolute' },
  bubble: {
    position: 'absolute',
    zIndex: 200,
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.neutral[800],
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  bubbleText: { fontSize: 13, fontWeight: '700', lineHeight: 17, color: colors.neutral[800] },
  bubbleButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.primary[500],
    borderBottomWidth: 3,
    borderBottomColor: colors.primary[700],
    justifyContent: 'center',
  },
  bubbleButtonText: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actions: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
});
