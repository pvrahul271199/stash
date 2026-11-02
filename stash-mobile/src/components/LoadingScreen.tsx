import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/fonts';
import { WORDMARK_PATH } from './logoPath';

/** Stash logo: ink tile with the "Stash" wordmark drawn as a path (no font dependency). */
export function Logo({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width={100} height={100} rx={22} fill={colors.ink} />
      <Path d={WORDMARK_PATH} fill="#FFFFFF" />
    </Svg>
  );
}

const RING = 96;

/**
 * Calm full-screen loader shown while the app resolves fonts, local data and the calendar.
 * Pulsing halo + spinning teal arc around the logo, with a gently breathing message.
 */
export function LoadingScreen({ message = 'Opening your stash…' }: { message?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    spinLoop.start();
    pulseLoop.start();
    breatheLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      breatheLoop.stop();
    };
  }, [spin, pulse, breathe]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const textOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.ringBox}>
        <Animated.View
          style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
        />
        <View style={styles.track} />
        <Animated.View style={[styles.arc, { transform: [{ rotate }] }]} />
        <Logo size={56} />
      </View>
      <Animated.Text style={[styles.message, { opacity: textOpacity }]}>{message}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  ringBox: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    backgroundColor: colors.goodBg,
  },
  track: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    borderWidth: 3,
    borderColor: colors.line,
  },
  arc: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: colors.good,
  },
  message: {
    marginTop: 32,
    fontFamily: fonts.sans500,
    fontSize: 15,
    color: colors.soft,
    textAlign: 'center',
  },
});
