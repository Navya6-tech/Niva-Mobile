import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SOSButtonProps {
  onPress: () => void;
  size?: number;
}

export function SOSButton({ onPress, size = 140 }: SOSButtonProps) {
  const colors = useColors();
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1.6,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const p1 = createPulse(pulse1, 0);
    const p2 = createPulse(pulse2, 400);
    const p3 = createPulse(pulse3, 800);
    p1.start();
    p2.start();
    p3.start();

    return () => {
      p1.stop();
      p2.stop();
      p3.stop();
    };
  }, [pulse1, pulse2, pulse3]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.93,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const ringSize = size * 1.6;

  return (
    <View style={[styles.container, { width: ringSize, height: ringSize }]}>
      {[pulse1, pulse2, pulse3].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: colors.destructive,
              opacity: anim.interpolate({
                inputRange: [1, 1.6],
                outputRange: [0.4, 0],
              }),
              transform: [{ scale: anim }],
            },
          ]}
        />
      ))}
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.destructive,
              shadowColor: colors.destructive,
              transform: [{ scale: pressScale }],
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.destructiveForeground }]}>SOS</Text>
          <Text style={[styles.sublabel, { color: "rgba(255,255,255,0.8)" }]}>
            Hold to alert
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  label: {
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 2,
  },
  sublabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    marginTop: -2,
  },
});
