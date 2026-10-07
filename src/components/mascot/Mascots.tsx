import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import { MascotMood } from '../../types';
import { colors, mascotColors as c, withAlpha } from '../../theme';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
}

// The artwork is drawn on a 1254×1254 canvas; this crop keeps Lex centred.
const VIEW_BOX = '56 60 1130 1150';

const LEG = 'M558,920 L624,920 L624,996 L616,997 L591,1125 L482,1110 L486,1044 L549,1039 Z';
const SHOE =
  'M486,1100 C455,1104 436,1114 423,1128 C415,1137 411,1148 414,1160 C417,1170 424,1174 432,1174 L580,1174 C589,1174 594,1166 594,1157 L591,1122 C560,1110 520,1100 486,1100 Z';
const COAT =
  'M522,701 L492,759 L521,775 L502,801 L558,881 L549,1043 L437,1041 L445,994 L455,942 L481,807 L481,726 Z';
const COLLAR = 'M522,701 L492,759 L521,775 L502,801 L558,881 L558,706 Z';
const POCKET = 'M476,925 L529,918 L532,972 L470,980 Z';
const EYEBROW =
  'M410,435 C405,405 435,382 470,376 C468,366 464,358 466,350 C500,338 548,342 578,368 C592,382 594,402 584,414 C560,402 530,400 495,412 C462,424 445,448 424,456 C414,452 411,444 410,435 Z';
const HAIR_BACK =
  'M660,78 C665,100 660,115 672,128 C690,150 710,152 745,168 C800,190 850,215 868,262 C872,285 868,298 866,306 C900,290 930,275 955,265 C975,300 990,340 975,385 C965,420 950,445 932,466 C960,475 990,485 1015,496 C1000,525 975,565 915,612 L937,650 C900,670 840,690 770,690 L470,690 C400,690 340,670 305,645 L328,614 C280,590 250,550 230,508 C260,495 285,480 304,466 C280,440 270,400 245,370 L228,350 C270,320 320,300 370,306 C360,280 355,250 365,215 C375,185 395,165 415,157 C430,175 450,190 480,198 C510,205 530,208 549,213 C545,180 555,140 590,110 C620,92 645,85 660,78 Z';
const HAIR_FRONT =
  'M383,380 L383,505 C387,500 398,482 405,473 C412,464 419,458 428,450 C437,442 448,434 458,427 C468,420 480,414 490,410 C500,406 510,406 520,405 C530,404 542,404 552,405 C562,406 572,410 582,414 C592,418 601,423 609,427 C617,431 622,438 629,438 C636,438 640,431 648,427 C656,423 666,419 676,416 C686,413 696,410 706,408 C716,406 728,406 738,407 C748,408 758,408 768,412 C778,416 790,422 800,431 C810,440 820,458 827,467 C834,476 837,480 842,488 C847,496 854,508 857,512 L857,380 Z';
const HEAD =
  'M380,600 C380,500 425,410 625,405 C825,410 860,500 860,600 C860,660 780,705 620,705 C460,705 380,660 380,600 Z';

const Arm: React.FC<{ side: 'left' | 'right'; rotation: number }> = ({ side, rotation }) => {
  const isLeft = side === 'left';
  const [px, py] = isLeft ? [481, 740] : [762, 740];
  return (
    <G transform={rotation ? `rotate(${rotation} ${px} ${py})` : undefined}>
      {isLeft ? (
        <>
          <Path d="M481,726 L418,805 L383,860 L362,903 L453,942 L481,807 Z" fill={c.coat} />
          <Path
            d="M481,726 L418,805 L383,860 L362,903 L453,942 L481,807"
            fill="none"
            stroke={c.coatSeam}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Path
            d="M377,911 L420,932 L451,942 C449,975 443,995 432,1005 C422,1014 408,1018 394,1017 C376,1014 361,1003 357,987 C353,970 356,955 362,940 C366,928 372,918 377,911 Z"
            fill={c.ink}
          />
        </>
      ) : (
        <>
          <Path d="M762,726 L825,805 L860,860 L881,903 L790,942 L762,807 Z" fill={c.coat} />
          <Path
            d="M762,726 L825,805 L860,860 L881,903 L790,942 L762,807"
            fill="none"
            stroke={c.coatSeam}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Path
            d="M866,911 L823,932 L792,942 C794,975 800,995 811,1005 C821,1014 835,1018 849,1017 C867,1014 882,1003 886,987 C890,970 887,955 881,940 C877,928 871,918 866,911 Z"
            fill={c.ink}
          />
        </>
      )}
    </G>
  );
};

const Sparkle: React.FC<{ x: number; y: number; r: number; fill: string }> = ({ x, y, r, fill }) => (
  <Polygon
    points={`${x},${y - r} ${x + r * 0.28},${y - r * 0.28} ${x + r},${y} ${x + r * 0.28},${y + r * 0.28} ${x},${y + r} ${x - r * 0.28},${y + r * 0.28} ${x - r},${y} ${x - r * 0.28},${y - r * 0.28}`}
    fill={fill}
  />
);

/**
 * Lex: the blue-haired lab scientist mascot.
 * Moods: idle, happy, cheering, thinking, confused, victorious.
 */
export const LexMascot: React.FC<MascotProps> = ({ mood = 'idle', size = 110 }) => {
  const armsUp = mood === 'cheering' || mood === 'victorious';
  const joyfulEyes = mood === 'happy' || armsUp;
  const isThinking = mood === 'thinking';
  const isConfused = mood === 'confused';

  // Pupil offsets per mood (default: looking toward the viewer, slightly cross-eyed).
  const pupilShift = isThinking ? { dx: 18, dy: -30 } : { dx: 0, dy: 0 };
  // Confused: right brow shoots up, left brow dips.
  const leftBrowY = isConfused ? 34 : armsUp ? 10 : 24;
  const rightBrowY = isConfused ? -6 : armsUp ? 10 : 24;

  const renderArms = () => (
    <>
      <Arm side="left" rotation={armsUp ? 100 : 0} />
      <Arm side="right" rotation={armsUp ? -100 : 0} />
    </>
  );

  const renderEye = (cx: number, pupilX: number) =>
    joyfulEyes ? (
      <Path
        d={`M${cx - 38},${548} Q${cx},${490} ${cx + 38},${548}`}
        stroke={c.ink}
        strokeWidth={22}
        strokeLinecap="round"
        fill="none"
      />
    ) : (
      <Ellipse
        cx={pupilX + pupilShift.dx}
        cy={530 + pupilShift.dy}
        rx={28}
        ry={isConfused && cx > 620 ? 30 : 41}
        fill={c.ink}
      />
    );

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={VIEW_BOX}>
        {/* Ground shadow */}
        <Ellipse cx={621} cy={1178} rx={260} ry={26} fill={withAlpha(colors.neutral[900], 0.1)} />

        {/* Legs & shoes */}
        <Path d={LEG} fill={c.trousers} stroke={c.trousers} strokeWidth={3} strokeLinejoin="round" />
        <G transform="translate(1243,0) scale(-1,1)">
          <Path d={LEG} fill={c.trousers} stroke={c.trousers} strokeWidth={3} strokeLinejoin="round" />
        </G>
        <Path d={SHOE} fill={c.shoes} />
        <G transform="translate(1243,0) scale(-1,1)">
          <Path d={SHOE} fill={c.shoes} />
        </G>

        {/* Shirt, belt & tie */}
        <Rect x={557} y={690} width={131} height={230} fill={c.shirt} />
        <G fill={c.shirt} stroke={c.shirtSeam} strokeWidth={4} strokeLinejoin="round">
          <Path d="M566,706 L608,711 L588,746 Z" />
          <Path d="M677,706 L635,711 L655,746 Z" />
        </G>
        <Rect x={558} y={908} width={128} height={40} fill={c.ink} />
        <Rect x={591} y={905} width={63} height={44} rx={4} fill={c.buckle} />
        <Rect x={603} y={917} width={40} height={22} fill={c.ink} />
        <Path
          d="M607,766 L637,764 L657,850 L622,886 L586,850 Z"
          fill={c.tie}
          stroke={c.tie}
          strokeWidth={4}
          strokeLinejoin="miter"
        />
        <Path
          d="M615,715 L629,715 L649,741 L637,765 L607,766 L595,741 Z"
          fill={c.tieKnot}
          stroke={c.tieKnot}
          strokeWidth={4}
          strokeLinejoin="round"
        />

        {/* Lab coat */}
        {[undefined, 'translate(1243,0) scale(-1,1)'].map((transform, i) => (
          <G key={i} transform={transform}>
            <Path d={COAT} fill={c.coat} stroke={c.coatSeam} strokeWidth={5} strokeLinejoin="round" />
            <Path d={COLLAR} fill={c.coat} stroke={c.coatSeam} strokeWidth={5} strokeLinejoin="round" />
            <Path d={POCKET} fill={c.coat} stroke={c.coatSeam} strokeWidth={4} strokeLinejoin="round" />
          </G>
        ))}

        {/* Arms hang behind the hair; raised arms are drawn last so they sit in front */}
        {!armsUp && renderArms()}

        {/* Hair, head & fringe */}
        <Path d={HAIR_BACK} fill={c.hair} />
        <Path d={HEAD} fill={c.skin} />
        <Path d={HAIR_FRONT} fill={c.hair} />

        {/* Eyebrows */}
        <G transform={`translate(0,${leftBrowY})`}>
          <Path d={EYEBROW} fill={c.eyebrow} stroke={c.eyebrow} strokeWidth={10} strokeLinejoin="round" />
        </G>
        <G transform={`translate(1240,${rightBrowY}) scale(-1,1)`}>
          <Path d={EYEBROW} fill={c.eyebrow} stroke={c.eyebrow} strokeWidth={10} strokeLinejoin="round" />
        </G>

        {/* Eyes: eyeball, glasses lens + frame, pupil */}
        <Circle cx={513} cy={530} r={74} fill={c.lens} stroke={c.ink} strokeWidth={6} />
        <Circle cx={513} cy={527} r={100} fill={c.lens} stroke={c.ink} strokeWidth={25} />
        {renderEye(513, 540)}
        <Circle cx={727} cy={530} r={74} fill={c.lens} stroke={c.ink} strokeWidth={6} />
        <Circle cx={727} cy={527} r={100} fill={c.lens} stroke={c.ink} strokeWidth={25} />
        {renderEye(727, 700)}

        {armsUp && renderArms()}

        {/* Thinking: little thought bubbles */}
        {isThinking && (
          <G fill={colors.primary[200]}>
            <Circle cx={900} cy={300} r={22} />
            <Circle cx={965} cy={225} r={34} />
            <Circle cx={1060} cy={130} r={54} />
          </G>
        )}

        {/* Confused: question mark */}
        {isConfused && (
          <Path
            d="M960,170 C960,110 1060,110 1060,170 C1060,215 1010,215 1010,260 M1010,310 L1010,312"
            stroke={colors.primary[500]}
            strokeWidth={30}
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Victorious: sparkles */}
        {mood === 'victorious' && (
          <G>
            <Sparkle x={200} y={220} r={60} fill={colors.primary[400]} />
            <Sparkle x={1050} y={190} r={70} fill={colors.primary[500]} />
            <Sparkle x={1080} y={420} r={36} fill={colors.primary[300]} />
            <Sparkle x={170} y={450} r={32} fill={colors.primary[300]} />
          </G>
        )}
      </Svg>
    </View>
  );
};
