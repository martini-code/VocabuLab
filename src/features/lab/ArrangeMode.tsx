import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from 'lucide-react-native';
import { colors } from '../../theme';
import { LAB_COLS, LAB_FLOOR_ROW, LAB_ITEMS, LAB_ROWS, LabItemId } from './catalog';
import { checkPlacement, drawOrder, findFreeSpot, PlacementProblem } from './grid';
import { ItemArt } from './itemArt';
import { LabState, storedItems } from './labStore';
import { itemDepth, itemRect, roomGeometry } from './roomGeometry';
import { RoomBackdrop } from './RoomBackdrop';

interface ArrangeModeProps {
  lab: LabState;
  onChange: (next: LabState) => void;
  onDone: () => void;
  onOpenShop?: () => void;
}

type DragSource = 'room' | 'tray';

interface Drag {
  id: LabItemId;
  from: DragSource;
  x: number;
  y: number;
  offX: number;
  offY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

type Evaluation =
  | { overTray: true }
  | { overTray: false; c: number; r: number; ok: boolean; problem?: PlacementProblem };

interface DragHandlers {
  begin: (id: LabItemId, from: DragSource, pageX: number, pageY: number) => void;
  move: (pageX: number, pageY: number) => void;
  end: () => void;
  cancel: () => void;
}

const TRAY_HEIGHT = 250;
const MOVE_THRESHOLD = 6;

/** Wraps an item so it can be picked up and dragged with one finger. */
const Draggable: React.FC<{
  id: LabItemId;
  from: DragSource;
  handlers: React.MutableRefObject<DragHandlers>;
  style: object;
  accessibilityLabel: string;
  children: React.ReactNode;
}> = ({ id, from, handlers, style, accessibilityLabel, children }) => {
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) =>
        handlers.current.begin(id, from, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e: GestureResponderEvent) =>
        handlers.current.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => handlers.current.end(),
      onPanResponderTerminate: () => handlers.current.cancel(),
    })
  );
  return (
    <View
      {...responder.panHandlers}
      style={style}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
};

export const ArrangeMode: React.FC<ArrangeModeProps> = ({ lab, onChange, onDone, onOpenShop }) => {
  const { t } = useTranslation();
  const rootRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [roomSize, setRoomSize] = useState<{ width: number; height: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const g = roomSize ? roomGeometry(roomSize.width, roomSize.height, 20) : null;
  const name = (id: LabItemId) => t(`lab.items.${id}`, { defaultValue: LAB_ITEMS[id].name });

  const problemText = (problem: PlacementProblem) =>
    ({
      outside: t('lab.arrange.outside', { defaultValue: "That's outside the room" }),
      wall_only: t('lab.arrange.wall_only', { defaultValue: 'Wall items hang on the wall' }),
      floor_only: t('lab.arrange.floor_only', { defaultValue: 'This one stands on the floor' }),
      taken: t('lab.arrange.taken', { defaultValue: 'That spot is taken' }),
    })[problem];

  const measureOrigin = () => {
    rootRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  };

  const evaluate = (d: Drag): Evaluation | null => {
    if (!g || !roomSize) return null;
    if (d.y > roomSize.height) return { overTray: true };
    const c = Math.round((d.x - d.offX - g.left) / g.cell);
    const r = Math.round((d.y - d.offY - g.top) / g.cell);
    const check = checkPlacement(lab.layout, d.id, c, r);
    return check.ok
      ? { overTray: false, c, r, ok: true }
      : { overTray: false, c, r, ok: false, problem: check.problem };
  };

  const placeAnywhere = (id: LabItemId) => {
    const spot = findFreeSpot(lab.layout, id);
    if (!spot) {
      setNote(
        t('lab.arrange.no_space', {
          defaultValue: 'No free spot for the {{item}}. Store something first.',
          item: name(id).toLowerCase(),
        })
      );
      return;
    }
    onChange({ ...lab, layout: { ...lab.layout, [id]: spot } });
    setNote(t('lab.arrange.added', { defaultValue: '{{item}} added', item: name(id) }));
  };

  const store = (id: LabItemId) => {
    const layout = { ...lab.layout };
    delete layout[id];
    onChange({ ...lab, layout });
    setNote(t('lab.arrange.stored', { defaultValue: '{{item}} put in storage', item: name(id) }));
  };

  const handlers = useRef<DragHandlers>({
    begin: () => {},
    move: () => {},
    end: () => {},
    cancel: () => {},
  });
  // Keep the drag callbacks current without recreating each item's PanResponder.
  useLayoutEffect(() => {
    handlers.current = {
      begin: (id, from, pageX, pageY) => {
        if (!g) return;
        measureOrigin();
        const x = pageX - origin.current.x;
        const y = pageY - origin.current.y;
        const item = LAB_ITEMS[id];
        let offX = (item.w * g.cell) / 2;
        let offY = item.h * g.cell * 0.65;
        const pos = lab.layout[id];
        if (from === 'room' && pos) {
          const rect = itemRect(g, id, pos.c, pos.r);
          offX = x - rect.x;
          offY = y - rect.y;
        }
        const next = { id, from, x, y, offX, offY, startX: x, startY: y, moved: false };
        dragRef.current = next;
        setDrag(next);
        setNote(null);
      },
      move: (pageX, pageY) => {
        const d = dragRef.current;
        if (!d) return;
        const x = pageX - origin.current.x;
        const y = pageY - origin.current.y;
        const moved = d.moved || Math.abs(x - d.startX) + Math.abs(y - d.startY) > MOVE_THRESHOLD;
        const next = { ...d, x, y, moved };
        dragRef.current = next;
        setDrag(next);
      },
      end: () => {
        const d = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!d) return;
        if (!d.moved) {
          if (d.from === 'tray') placeAnywhere(d.id);
          return;
        }
        const ev = evaluate(d);
        if (!ev) return;
        if (ev.overTray) {
          if (d.from === 'room') store(d.id);
          return;
        }
        if (ev.ok) {
          onChange({ ...lab, layout: { ...lab.layout, [d.id]: { c: ev.c, r: ev.r } } });
        } else if (ev.problem) {
          setNote(problemText(ev.problem));
        }
      },
      cancel: () => {
        dragRef.current = null;
        setDrag(null);
      },
    };
  });

  const live = drag && drag.moved ? drag : null;
  const ev = live ? evaluate(live) : null;
  const target = new Set<number>();
  if (live && ev && !ev.overTray) {
    const item = LAB_ITEMS[live.id];
    for (let i = 0; i < item.w; i++) {
      for (let j = 0; j < item.h; j++) target.add((ev.r + j) * LAB_COLS + ev.c + i);
    }
  }

  let hint = note;
  let hintTone: 'idle' | 'good' | 'bad' = 'idle';
  if (live && ev) {
    if (ev.overTray) {
      hint =
        live.from === 'room'
          ? t('lab.arrange.release_store', { defaultValue: 'Let go to store it' })
          : t('lab.arrange.drag_up', { defaultValue: 'Drag it up into the room' });
      hintTone = live.from === 'room' ? 'good' : 'idle';
    } else if (ev.ok) {
      hint = t('lab.arrange.release_place', { defaultValue: 'Let go to place it' });
      hintTone = 'good';
    } else if (ev.problem) {
      hint = problemText(ev.problem);
      hintTone = 'bad';
    }
  }

  const stored = storedItems(lab);

  return (
    <View ref={rootRef} style={styles.container} onLayout={measureOrigin} testID="lab-arrange">
      <View
        style={styles.room}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setRoomSize({ width, height });
        }}
      >
        {g && (
          <>
            <RoomBackdrop g={g} showLamp={false} />
            {Array.from({ length: LAB_ROWS * LAB_COLS }, (_, idx) => {
              const r = Math.floor(idx / LAB_COLS);
              const c = idx % LAB_COLS;
              const zone = live ? LAB_ITEMS[live.id].zone : null;
              const inZone = zone === 'wall' ? r < LAB_FLOOR_ROW : r >= LAB_FLOOR_ROW - 1;
              let look: ViewStyle = styles.cellIdle;
              if (target.has(idx))
                look = ev && !ev.overTray && ev.ok ? styles.cellOk : styles.cellBad;
              else if (zone && inZone) look = styles.cellZone;
              else if (zone) look = styles.cellHidden;
              return (
                <View
                  key={idx}
                  pointerEvents="none"
                  style={[
                    styles.cell,
                    look,
                    {
                      left: g.left + c * g.cell + 3,
                      top: g.top + r * g.cell + 3,
                      width: g.cell - 6,
                      height: g.cell - 6,
                    },
                  ]}
                />
              );
            })}
            {drawOrder(lab.layout).map((id) => {
              const pos = lab.layout[id];
              if (!pos) return null;
              const rect = itemRect(g, id, pos.c, pos.r);
              const pad = (LAB_ITEMS[id].pad * g.cell) / 84;
              const lifted = live?.id === id;
              return (
                <Draggable
                  key={id}
                  id={id}
                  from="room"
                  handlers={handlers}
                  accessibilityLabel={name(id)}
                  style={[
                    styles.placed,
                    {
                      left: rect.x,
                      top: rect.y,
                      width: rect.w,
                      height: rect.h,
                      padding: pad,
                      zIndex: itemDepth(lab.layout, id),
                      opacity: lifted ? 0.25 : 1,
                    },
                  ]}
                >
                  <ItemArt id={id} width={rect.w - pad * 2} height={rect.h - pad * 2} />
                  <Pressable
                    onPress={() => store(id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('lab.arrange.store_item', {
                      defaultValue: 'Put {{item}} in storage',
                      item: name(id),
                    })}
                    hitSlop={8}
                    style={styles.badge}
                  >
                    <Minus size={14} color={colors.neutral[0]} strokeWidth={3} />
                  </Pressable>
                </Draggable>
              );
            })}
          </>
        )}
        {hint ? (
          <View pointerEvents="none" style={styles.hintRow}>
            <Text
              style={[
                styles.hint,
                hintTone === 'good' && styles.hintGood,
                hintTone === 'bad' && styles.hintBad,
              ]}
            >
              {hint}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.tray, live?.from === 'room' && ev?.overTray && styles.trayActive]}>
        <View style={styles.trayHeader}>
          <View>
            <Text style={styles.trayTitle}>
              {t('lab.arrange.storage', { defaultValue: 'Storage' })}
            </Text>
            <Text style={styles.traySub}>
              {stored.length > 0
                ? t('lab.arrange.storage_hint', {
                    defaultValue: 'Tap or drag into the room',
                  })
                : t('lab.arrange.storage_empty', {
                    defaultValue: 'Drag an item here to store it',
                  })}
            </Text>
          </View>
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            style={styles.done}
            testID="lab-arrange-done"
          >
            <Text style={styles.doneText}>{t('lab.arrange.done', { defaultValue: 'Done' })}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.trayGrid}
          scrollEnabled={!drag}
          showsVerticalScrollIndicator={false}
        >
          {stored.map((id) => {
            const item = LAB_ITEMS[id];
            return (
              <Draggable
                key={id}
                id={id}
                from="tray"
                handlers={handlers}
                accessibilityLabel={t('lab.arrange.add_item', {
                  defaultValue: 'Add {{item}} to the room',
                  item: name(id),
                })}
                style={[styles.tile, { opacity: live?.id === id ? 0.3 : 1 }]}
              >
                <View style={styles.tileArt}>
                  <ItemArt id={id} width={64} height={44} />
                </View>
                <Text style={styles.tileName} numberOfLines={2}>
                  {name(id)}
                </Text>
                <Text style={styles.tileMeta}>
                  {item.w}×{item.h} ·{' '}
                  {item.zone === 'wall'
                    ? t('lab.arrange.wall', { defaultValue: 'Wall' })
                    : t('lab.arrange.floor', { defaultValue: 'Floor' })}
                </Text>
              </Draggable>
            );
          })}
          {onOpenShop && (
            <Pressable onPress={onOpenShop} accessibilityRole="button" style={styles.moreTile}>
              <Plus size={20} color={colors.primary[700]} />
              <Text style={styles.moreText}>
                {t('lab.arrange.get_more', { defaultValue: 'Get more' })}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {live && g && (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: live.x - live.offX,
              top: live.y - live.offY,
              width: LAB_ITEMS[live.id].w * g.cell,
              height: LAB_ITEMS[live.id].h * g.cell,
              padding: (LAB_ITEMS[live.id].pad * g.cell) / 84,
              transform: [{ scale: ev?.overTray && live.from === 'room' ? 0.7 : 1.06 }],
            },
          ]}
        >
          <ItemArt
            id={live.id}
            width={LAB_ITEMS[live.id].w * g.cell - ((LAB_ITEMS[live.id].pad * g.cell) / 84) * 2}
            height={LAB_ITEMS[live.id].h * g.cell - ((LAB_ITEMS[live.id].pad * g.cell) / 84) * 2}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary[50] },
  room: { flex: 1, overflow: 'hidden' },
  cell: { position: 'absolute', borderRadius: 16, borderWidth: 1.5 },
  cellIdle: { borderStyle: 'dashed', borderColor: 'rgba(0,95,204,0.18)' },
  cellZone: {
    borderStyle: 'dashed',
    borderColor: 'rgba(0,95,204,0.6)',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  cellHidden: { borderWidth: 0 },
  cellOk: {
    borderWidth: 2,
    borderColor: colors.primary[500],
    backgroundColor: 'rgba(26,128,255,0.22)',
  },
  cellBad: {
    borderWidth: 2,
    borderColor: colors.danger[600],
    backgroundColor: 'rgba(220,38,38,0.14)',
  },
  placed: { position: 'absolute' },
  badge: {
    position: 'absolute',
    left: -6,
    top: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.neutral[0],
    backgroundColor: colors.neutral[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', zIndex: 300 },
  hint: {
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.95)',
    color: colors.neutral[800],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  hintGood: {
    backgroundColor: colors.primary[500],
    color: colors.neutral[0],
    borderColor: colors.primary[700],
  },
  hintBad: {
    backgroundColor: colors.danger[50],
    color: colors.danger[800],
    borderColor: colors.danger[300],
  },
  tray: {
    height: TRAY_HEIGHT,
    marginTop: -12,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    borderColor: colors.neutral[200],
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  trayActive: { backgroundColor: colors.primary[100], borderColor: colors.primary[500] },
  trayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trayTitle: { fontSize: 16, fontWeight: '900', color: colors.neutral[900] },
  traySub: { fontSize: 12, fontWeight: '700', color: colors.neutral[500] },
  done: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.primary[500],
    borderBottomWidth: 4,
    borderBottomColor: colors.primary[700],
    justifyContent: 'center',
  },
  doneText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  trayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 24 },
  tile: {
    width: '23%',
    minHeight: 96,
    borderRadius: 16,
    padding: 6,
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  tileArt: { width: '100%', height: 46, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontSize: 11, fontWeight: '800', color: colors.neutral[900], textAlign: 'center' },
  tileMeta: { fontSize: 10, fontWeight: '700', color: colors.neutral[600] },
  moreTile: {
    width: '23%',
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary[300],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  moreText: { fontSize: 11, fontWeight: '800', color: colors.primary[700] },
  ghost: { position: 'absolute', zIndex: 500 },
});
