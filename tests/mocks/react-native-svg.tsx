import React from 'react';

const createSvgComponent = (tag: string) =>
  React.forwardRef<any, any>(({ children, testID, ...props }, ref) => {
    const effectiveTestId = testID || props['data-testid'] || `svg-${tag}`;
    return React.createElement(tag, { ref, testID: effectiveTestId, ...props }, children);
  });

export const Svg = createSvgComponent('svg');
export const Path = createSvgComponent('path');
export const Circle = createSvgComponent('circle');
export const Rect = createSvgComponent('rect');
export const Line = createSvgComponent('line');
export const Polyline = createSvgComponent('polyline');
export const Polygon = createSvgComponent('polygon');
export const G = createSvgComponent('g');
export const Text = createSvgComponent('text');
export const TSpan = createSvgComponent('tspan');
export const Defs = createSvgComponent('defs');
export const LinearGradient = createSvgComponent('linearGradient');
export const RadialGradient = createSvgComponent('radialGradient');
export const Stop = createSvgComponent('stop');
export const ClipPath = createSvgComponent('clipPath');

export default Svg;
