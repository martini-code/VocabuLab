import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse, Polygon } from 'react-native-svg';
import { MascotMood } from '../../types';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
}

/**
 * Squire Pip: The cheerful little medieval apprentice knight mascot!
 * Features animated moods: idle, happy, cheering, thinking, confused, victorious.
 */
export const SquireMascot: React.FC<MascotProps> = ({ mood = 'idle', size = 110 }) => {
  const isCheering = mood === 'cheering' || mood === 'victorious';
  const isConfused = mood === 'confused';
  const isThinking = mood === 'thinking';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Soft Shadow */}
        <Ellipse cx="50" cy="92" rx="32" ry="6" fill="#00000018" />

        {/* Knight Armor Body */}
        <Rect x="32" y="55" width="36" height="30" rx="10" fill="#94A3B8" stroke="#475569" strokeWidth="2.5" />
        {/* Breastplate Emblem (Golden Fleur-de-lis / Cross) */}
        <Path d="M50 60 L50 78 M42 66 L58 66" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />

        {/* Arms & Hands */}
        {isCheering ? (
          // Arms raised in victory!
          <G>
            {/* Left Arm up */}
            <Path d="M32 62 Q20 45 22 35" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
            <Circle cx="22" cy="34" r="5" fill="#FBBF24" />
            {/* Right Arm up with wooden sword */}
            <Path d="M68 62 Q80 45 78 35" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
            <Circle cx="78" cy="34" r="5" fill="#FBBF24" />
            {/* Cute wooden sword */}
            <Path d="M78 34 L92 18" stroke="#D97706" strokeWidth="4.5" strokeLinecap="round" />
            <Path d="M74 30 L84 25" stroke="#B45309" strokeWidth="3" strokeLinecap="round" />
          </G>
        ) : isConfused ? (
          // Left hand scratching helmet, right hand on hip
          <G>
            <Path d="M32 65 Q18 68 25 78" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
            <Circle cx="25" cy="78" r="5" fill="#FBBF24" />
            {/* Right arm scratching helmet */}
            <Path d="M68 65 Q82 50 68 28" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" fill="none" />
            <Circle cx="68" cy="28" r="5" fill="#FBBF24" />
          </G>
        ) : (
          // Idle: Holding little wooden shield
          <G>
            <Path d="M32 65 Q20 70 24 78" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
            <Circle cx="24" cy="78" r="5" fill="#FBBF24" />
            {/* Mini wooden shield */}
            <Path
              d="M70 60 Q85 62 85 75 Q85 88 70 94 Q55 88 55 75 Q55 62 70 60 Z"
              fill="#D97706"
              stroke="#78350F"
              strokeWidth="2"
            />
            <Path d="M70 65 L70 89 M60 74 L80 74" stroke="#FDE68A" strokeWidth="2" />
          </G>
        )}

        {/* Cute Round Helmet & Face */}
        <Circle cx="50" cy="38" r="24" fill="#CBD5E1" stroke="#475569" strokeWidth="2.5" />

        {/* Helmet Visor Plate */}
        <Path d="M28 32 Q50 25 72 32 Q74 44 72 45 Q50 38 28 45 Z" fill="#64748B" />

        {/* Cute Face Peeking Through Helmet */}
        <Ellipse cx="50" cy="40" rx="15" ry="11" fill="#FDE68A" />

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
            <Path d="M52 38 Q55 42 58 38" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
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
          <Path d="M46 45 Q50 43 54 46" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : (
          // Sweet gentle smile :)
          <Path d="M47 44 Q50 47 53 44" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Helmet Feather Plume (Crimson Knight Plume!) */}
        <Path
          d="M50 15 C52 5, 68 8, 64 22 C62 18, 55 16, 50 15 Z"
          fill="#EF4444"
          stroke="#B91C1C"
          strokeWidth="1.5"
        />
        <Circle cx="50" cy="15" r="3" fill="#F59E0B" />

        {/* Victory Laurel or Star Sparkles */}
        {mood === 'victorious' && (
          <G>
            <Polygon points="20,18 22,23 27,24 23,28 24,33 20,30 16,33 17,28 13,24 18,23" fill="#F59E0B" />
            <Polygon points="80,18 82,23 87,24 83,28 84,33 80,30 76,33 77,28 73,24 78,23" fill="#F59E0B" />
          </G>
        )}
      </Svg>
    </View>
  );
};

/**
 * Archmage Barnaby: Wise Owl Wizard with purple starry hat!
 */
export const WizardOwlMascot: React.FC<{ size?: number }> = ({ size = 90 }) => {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx="50" cy="88" rx="28" ry="6" fill="#00000015" />

        {/* Owl Body */}
        <Ellipse cx="50" cy="60" rx="26" ry="25" fill="#B45309" stroke="#78350F" strokeWidth="2" />
        {/* Soft Tummy */}
        <Ellipse cx="50" cy="64" rx="16" ry="18" fill="#FEF3C7" />
        {/* Feathery chest marks */}
        <Path d="M46 58 Q50 61 54 58 M44 65 Q50 68 56 65 M46 72 Q50 75 54 72" stroke="#D97706" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Owl Wings */}
        <Ellipse cx="26" cy="62" rx="7" ry="16" fill="#92400E" transform="rotate(15, 26, 62)" />
        <Ellipse cx="74" cy="62" rx="7" ry="16" fill="#92400E" transform="rotate(-15, 74, 62)" />

        {/* Little Owl Feet */}
        <Path d="M40 84 L40 88 M43 84 L45 88 M37 84 L35 88" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
        <Path d="M60 84 L60 88 M63 84 L65 88 M57 84 L55 88" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />

        {/* Big Owl Eyes */}
        <Circle cx="39" cy="46" r="11" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" />
        <Circle cx="61" cy="46" r="11" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" />
        <Circle cx="39" cy="46" r="6" fill="#1E293B" />
        <Circle cx="61" cy="46" r="6" fill="#1E293B" />
        <Circle cx="41" cy="44" r="2.2" fill="#FFFFFF" />
        <Circle cx="63" cy="44" r="2.2" fill="#FFFFFF" />

        {/* Wizard Spectacles */}
        <Circle cx="39" cy="46" r="12" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
        <Circle cx="61" cy="46" r="12" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
        <Path d="M51 46 L49 46" stroke="#F59E0B" strokeWidth="2.5" />

        {/* Little Beak */}
        <Polygon points="50,48 46,55 54,55" fill="#EA580C" />

        {/* Wizard Hat */}
        <Polygon points="50,2 25,32 75,32" fill="#6D28D9" stroke="#4C1D95" strokeWidth="2" />
        <Ellipse cx="50" cy="32" rx="30" ry="6" fill="#7C3AED" stroke="#4C1D95" strokeWidth="2" />
        {/* Hat Gold Star */}
        <Polygon points="50,14 52,18 56,18 53,21 54,25 50,23 46,25 47,21 44,18 48,18" fill="#FBBF24" />
      </Svg>
    </View>
  );
};
