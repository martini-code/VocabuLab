import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse, Polygon } from 'react-native-svg';
import { MascotMood } from '../../types';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
}

/**
 * Pip the Lab Assistant: The cheerful little scientist mascot in a lab coat and safety goggles!
 * Features animated moods: idle, happy, cheering, thinking, confused, victorious.
 */
export const LabMascot: React.FC<MascotProps> = ({ mood = 'idle', size = 110 }) => {
  const isCheering = mood === 'cheering' || mood === 'victorious';
  const isConfused = mood === 'confused';
  const isThinking = mood === 'thinking';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Soft Shadow */}
        <Ellipse cx="50" cy="92" rx="32" ry="6" fill="#00000018" />

        {/* Lab Coat Body */}
        <Rect
          x="32"
          y="55"
          width="36"
          height="30"
          rx="10"
          fill="#F8FAFC"
          stroke="#94A3B8"
          strokeWidth="2.5"
        />
        {/* Teal shirt peeking between the lapels */}
        <Path d="M43 57 L50 67 L57 57 Z" fill="#14B8A6" />
        {/* Coat Lapels */}
        <Path
          d="M42 56 L50 68 L58 56"
          stroke="#94A3B8"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Breast Pocket with Pen */}
        <Rect
          x="55"
          y="71"
          width="9"
          height="7"
          rx="1.5"
          fill="none"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />
        <Path d="M59.5 67 L59.5 73" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" />

        {/* Arms & Hands */}
        {isCheering ? (
          // Arms raised in victory!
          <G>
            {/* Left Arm up */}
            <Path d="M32 62 Q20 45 22 35" stroke="#E2E8F0" strokeWidth="7" strokeLinecap="round" />
            <Circle cx="22" cy="34" r="5" fill="#FBBF24" />
            {/* Right Arm up with test tube */}
            <Path d="M68 62 Q80 45 78 35" stroke="#E2E8F0" strokeWidth="7" strokeLinecap="round" />
            <Circle cx="78" cy="34" r="5" fill="#FBBF24" />
            {/* Bubbling test tube held aloft */}
            <G transform="rotate(35, 82, 22)">
              <Rect
                x="79"
                y="8"
                width="7"
                height="24"
                rx="3.5"
                fill="#E0F2FE"
                stroke="#0369A1"
                strokeWidth="1.5"
              />
              <Rect x="79.75" y="19" width="5.5" height="12" rx="2.75" fill="#22C55E" />
            </G>
            <Circle cx="92" cy="8" r="1.8" fill="#86EFAC" />
            <Circle cx="96" cy="3" r="1.2" fill="#86EFAC" />
          </G>
        ) : isConfused ? (
          // Right hand scratching head, left hand on hip
          <G>
            <Path d="M32 65 Q18 68 25 78" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
            <Circle cx="25" cy="78" r="5" fill="#FBBF24" />
            {/* Right arm scratching head */}
            <Path
              d="M68 65 Q82 50 68 28"
              stroke="#E2E8F0"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="68" cy="28" r="5" fill="#FBBF24" />
          </G>
        ) : (
          // Idle: Holding a little round-bottom flask
          <G>
            <Path d="M32 65 Q20 70 24 78" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
            <Circle cx="24" cy="78" r="5" fill="#FBBF24" />
            {/* Mini round-bottom flask */}
            <Rect
              x="66"
              y="59"
              width="8"
              height="12"
              fill="#E0F2FE"
              stroke="#0369A1"
              strokeWidth="2"
            />
            <Rect x="64" y="57" width="12" height="3" rx="1.5" fill="#0369A1" />
            <Circle cx="70" cy="80" r="12" fill="#E0F2FE" stroke="#0369A1" strokeWidth="2" />
            {/* Glowing reagent */}
            <Path d="M58.5 81 A11.5 11.5 0 0 0 81.5 81 Z" fill="#A78BFA" />
            <Circle cx="66" cy="77" r="1.5" fill="#FFFFFF" opacity="0.8" />
            <Circle cx="73" cy="74" r="1" fill="#FFFFFF" opacity="0.8" />
          </G>
        )}

        {/* Cute Round Head */}
        <Circle cx="50" cy="38" r="22" fill="#FDE68A" stroke="#B45309" strokeWidth="2" />

        {/* Tousled Scientist Hair */}
        <Path
          d="M29 33 Q31 15 50 15 Q69 15 71 33 Q64 25 57 27 Q50 21 43 27 Q36 25 29 33 Z"
          fill="#7C2D12"
        />

        {/* Safety Goggles pushed up on the forehead */}
        <Path
          d="M29 29 Q50 22 71 29"
          stroke="#0F766E"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx="42" cy="26" r="5.5" fill="#99F6E4" stroke="#0F766E" strokeWidth="2" />
        <Circle cx="58" cy="26" r="5.5" fill="#99F6E4" stroke="#0F766E" strokeWidth="2" />

        {/* Eyes */}
        {isCheering ? (
          // Happy closed curving crescent eyes ^ ^
          <G stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" fill="none">
            <Path d="M42 39 Q45 35 48 39" />
            <Path d="M52 39 Q55 35 58 39" />
          </G>
        ) : isConfused ? (
          // One wide round eye, one squiggly confused eye
          <G>
            <Circle cx="44" cy="39" r="3.5" fill="#1E293B" />
            <Path
              d="M52 38 Q55 42 58 38"
              stroke="#1E293B"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </G>
        ) : isThinking ? (
          // Eyes looking up
          <G fill="#1E293B">
            <Circle cx="45" cy="36" r="3" />
            <Circle cx="55" cy="36" r="3" />
          </G>
        ) : (
          // Big adorable cartoon eyes with highlights
          <G>
            <Circle cx="44" cy="39" r="3.5" fill="#1E293B" />
            <Circle cx="45.5" cy="37.5" r="1.2" fill="#FFFFFF" />
            <Circle cx="56" cy="39" r="3.5" fill="#1E293B" />
            <Circle cx="57.5" cy="37.5" r="1.2" fill="#FFFFFF" />
          </G>
        )}

        {/* Rosy Cheeks */}
        <Circle cx="38" cy="43" r="3" fill="#F87171" opacity="0.6" />
        <Circle cx="62" cy="43" r="3" fill="#F87171" opacity="0.6" />

        {/* Mouth */}
        {isCheering ? (
          // Big happy open mouth :D
          <Path d="M46 44 Q50 50 54 44 Z" fill="#DC2626" />
        ) : isConfused ? (
          // Wavy curious mouth ~
          <Path
            d="M46 45 Q50 43 54 46"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          // Sweet gentle smile :)
          <Path
            d="M47 44 Q50 47 53 44"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Stray Cowlick Curl */}
        <Path
          d="M50 15 Q46 7 54 6"
          stroke="#7C2D12"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Eureka Star Sparkles */}
        {mood === 'victorious' && (
          <G>
            <Polygon
              points="20,18 22,23 27,24 23,28 24,33 20,30 16,33 17,28 13,24 18,23"
              fill="#F59E0B"
            />
            <Polygon
              points="80,18 82,23 87,24 83,28 84,33 80,30 76,33 77,28 73,24 78,23"
              fill="#F59E0B"
            />
          </G>
        )}
      </Svg>
    </View>
  );
};

/**
 * Professor Barnaby: Wise owl scientist with spectacles and a graduation cap!
 */
export const ProfessorOwlMascot: React.FC<{ size?: number }> = ({ size = 90 }) => {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx="50" cy="88" rx="28" ry="6" fill="#00000015" />

        {/* Owl Body */}
        <Ellipse cx="50" cy="60" rx="26" ry="25" fill="#B45309" stroke="#78350F" strokeWidth="2" />
        {/* Soft Tummy */}
        <Ellipse cx="50" cy="64" rx="16" ry="18" fill="#FEF3C7" />
        {/* Feathery chest marks */}
        <Path
          d="M46 58 Q50 61 54 58 M44 65 Q50 68 56 65 M46 72 Q50 75 54 72"
          stroke="#D97706"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Owl Wings */}
        <Ellipse cx="26" cy="62" rx="7" ry="16" fill="#92400E" transform="rotate(15, 26, 62)" />
        <Ellipse cx="74" cy="62" rx="7" ry="16" fill="#92400E" transform="rotate(-15, 74, 62)" />

        {/* Little Owl Feet */}
        <Path
          d="M40 84 L40 88 M43 84 L45 88 M37 84 L35 88"
          stroke="#D97706"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Path
          d="M60 84 L60 88 M63 84 L65 88 M57 84 L55 88"
          stroke="#D97706"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Big Owl Eyes */}
        <Circle cx="39" cy="46" r="11" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" />
        <Circle cx="61" cy="46" r="11" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" />
        <Circle cx="39" cy="46" r="6" fill="#1E293B" />
        <Circle cx="61" cy="46" r="6" fill="#1E293B" />
        <Circle cx="41" cy="44" r="2.2" fill="#FFFFFF" />
        <Circle cx="63" cy="44" r="2.2" fill="#FFFFFF" />

        {/* Professor Spectacles */}
        <Circle cx="39" cy="46" r="12" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
        <Circle cx="61" cy="46" r="12" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
        <Path d="M51 46 L49 46" stroke="#F59E0B" strokeWidth="2.5" />

        {/* Little Beak */}
        <Polygon points="50,48 46,55 54,55" fill="#EA580C" />

        {/* Graduation Cap (Mortarboard) */}
        <Path d="M34 31 L34 21 Q50 17 66 21 L66 31 Q50 35 34 31 Z" fill="#1E293B" />
        <Polygon points="50,6 82,17 50,28 18,17" fill="#334155" stroke="#0F172A" strokeWidth="2" />
        {/* Gold Tassel */}
        <Circle cx="50" cy="17" r="2" fill="#FBBF24" />
        <Path
          d="M50 17 Q68 19 76 23 L76 33"
          stroke="#FBBF24"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <Rect x="74" y="32" width="4" height="6" rx="1" fill="#FBBF24" />
      </Svg>
    </View>
  );
};
