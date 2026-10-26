import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme';
import { RoomGeometry } from './roomGeometry';

const PLANK = 26;
const JOINT_OFFSETS = [88, 38, 108, 58, 10, 128, 68, 18, 98, 48];

/** Wall, crown molding, pendant light, wainscot and wooden floor behind the furniture. */
export const RoomBackdrop: React.FC<{ g: RoomGeometry; showLamp?: boolean }> = ({
  g,
  showLamp = true,
}) => {
  const { width, height, floorY } = g;
  const wainscotTop = floorY - Math.round(g.cell * 0.65);
  const rows: string[] = [];
  const joints: string[] = [];
  for (let y = floorY, i = 0; y < height; y += PLANK, i++) {
    if (y > floorY) rows.push(`M0 ${y} H${width}`);
    for (let x = JOINT_OFFSETS[i % JOINT_OFFSETS.length]; x < width; x += 120) {
      joints.push(`M${x} ${y} V${Math.min(y + PLANK, height)}`);
    }
  }
  const lampX = Math.round(width * 0.66);
  const cordEnd = Math.max(40, Math.min(g.top - 6, 96));

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} fill={colors.primary[100]} />

      {/* Crown molding */}
      <Rect x={0} y={0} width={width} height={7} fill={colors.neutral[0]} />
      <Rect x={0} y={7} width={width} height={5} fill="#DCE8FA" />
      <Rect x={0} y={7} width={width} height={1.5} fill={colors.primary[200]} />
      <Rect x={0} y={12} width={width} height={4} fill={colors.neutral[0]} />
      <Rect x={0} y={16} width={width} height={1.5} fill={colors.primary[200]} />

      {/* Wainscot, chair rail and baseboard */}
      <Rect
        x={0}
        y={wainscotTop}
        width={width}
        height={floorY - wainscotTop}
        fill={colors.primary[200]}
      />
      <Rect x={0} y={wainscotTop} width={width} height={6} fill={colors.neutral[0]} />
      <Rect x={0} y={floorY - 8} width={width} height={8} fill={colors.neutral[0]} />

      {/* Floor planks */}
      <Rect x={0} y={floorY} width={width} height={height - floorY} fill={colors.cream[200]} />
      <Rect x={0} y={floorY} width={width} height={6} fill={colors.cream[300]} />
      <Path d={rows.join(' ')} stroke={colors.cream[300]} strokeWidth={2} />
      <Path d={joints.join(' ')} stroke="#E9B38E" strokeWidth={2} />

      {showLamp && (
        <>
          <Path
            d={`M${lampX - 12} 16 H${lampX + 12} C${lampX + 12} 21 ${lampX + 7} 23 ${lampX} 23 C${lampX - 7} 23 ${lampX - 12} 21 ${lampX - 12} 16 Z`}
            fill={colors.neutral[0]}
            stroke={colors.primary[200]}
            strokeWidth={1.5}
          />
          <Path d={`M${lampX} 22 V${cordEnd}`} stroke={colors.neutral[600]} strokeWidth={1.5} />
          <Path
            d={`M${lampX - 12} ${cordEnd + 13} C${lampX - 12} ${cordEnd + 4} ${lampX - 7} ${cordEnd} ${lampX} ${cordEnd} C${lampX + 7} ${cordEnd} ${lampX + 12} ${cordEnd + 4} ${lampX + 12} ${cordEnd + 13} Z`}
            fill={colors.primary[500]}
          />
          <Rect
            x={lampX - 13}
            y={cordEnd + 12}
            width={26}
            height={3}
            rx={1.5}
            fill={colors.primary[700]}
          />
          <Ellipse cx={lampX} cy={cordEnd + 16} rx={5} ry={3} fill={colors.cream[100]} />
        </>
      )}
    </Svg>
  );
};
