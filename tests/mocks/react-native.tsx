import React from 'react';

// Lightweight pure React Native mock for unit & integration testing in headless Node
const createComponent = (name: string) => {
  const Comp = React.forwardRef(({ children, testID, ...props }: any, ref: any) => {
    return React.createElement(name, { ref, testID, ...props }, children);
  });
  Comp.displayName = name;
  return Comp;
};

export const View = createComponent('View');
export const Text = createComponent('Text');
export const ScrollView = createComponent('ScrollView');
export const SafeAreaView = createComponent('SafeAreaView');

export const TouchableOpacity = React.forwardRef(
  ({ children, onPress, testID, ...props }: any, ref: any) => {
    return React.createElement(
      'View',
      {
        ref,
        testID,
        onClick: onPress,
        onResponderRelease: onPress,
        onPress,
        ...props,
      },
      children
    );
  }
);
TouchableOpacity.displayName = 'TouchableOpacity';

export const Pressable = React.forwardRef(
  ({ children, onPress, style, testID, ...props }: any, ref: any) => {
    const resolvedChildren =
      typeof children === 'function' ? children({ pressed: false }) : children;
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;

    return React.createElement(
      'View',
      {
        ref,
        testID,
        onClick: onPress,
        onResponderRelease: onPress,
        onPress,
        style: resolvedStyle,
        ...props,
      },
      resolvedChildren
    );
  }
);
Pressable.displayName = 'Pressable';

export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (styles: any) => (Array.isArray(styles) ? Object.assign({}, ...styles) : styles || {}),
};

export const Platform = {
  OS: 'ios',
  select: (obj: any) => obj.ios ?? obj.default,
};

export default {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
};
