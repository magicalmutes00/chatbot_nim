import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { blurIntensity, colors } from '../theme/glass';

/**
 * Full-screen dark backdrop with three decorative color blobs. The blobs use
 * high-intensity BlurView so they read as soft glows rather than hard circles.
 * Children render on top via absoluteFillObject in screen layouts.
 */
export function GlassBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.base} />
      <View style={[styles.blob, { backgroundColor: colors.blob1, top: -120, left: -100, width: 420, height: 420 }]} />
      <View
        style={[
          styles.blob,
          { backgroundColor: colors.blob2, top: 80, right: -160, width: 380, height: 380 },
        ]}
      />
      <View
        style={[
          styles.blob,
          { backgroundColor: colors.blob3, bottom: -180, left: -80, width: 460, height: 460 },
        ]}
      />
<BlurView
        blurType="dark"
        blurAmount={blurIntensity.blob}
        reducedTransparencyFallbackColor={colors.bgBase}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase, overflow: 'hidden' },
  base: { ...StyleSheet.absoluteFill, backgroundColor: colors.bgBase },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.55 },
});
