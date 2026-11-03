import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space, usePalette } from '@/theme';

export function Screen({
  children,
  scroll = true,
  safeTop = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  safeTop?: boolean;
}) {
  const c = usePalette();
  // On web the tab bar floats over the top of the page; leave room for it.
  const top = safeTop && Platform.OS === 'web' ? { paddingTop: 76 } : null;
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, top]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, top, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView
      edges={safeTop ? ['top', 'left', 'right'] : ['left', 'right']}
      style={{ flex: 1, backgroundColor: c.bg }}>
      {inner}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label';

export function T({
  variant = 'body',
  style,
  color,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const c = usePalette();
  const base = {
    title: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5, color: c.text },
    heading: { fontSize: 18, fontWeight: '700' as const, color: c.text },
    body: { fontSize: 16, color: c.text },
    muted: { fontSize: 15, color: c.textMuted },
    small: { fontSize: 13, color: c.textMuted },
    label: {
      fontSize: 12,
      fontWeight: '700' as const,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
      color: c.textMuted,
    },
  }[variant];
  return <Text style={[base, color ? { color } : null, style]} {...rest} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  const c = usePalette();
  const bg = { primary: c.primary, secondary: c.surfaceAlt, danger: 'transparent', ghost: 'transparent' }[kind];
  const fg = { primary: c.primaryText, secondary: c.text, danger: c.danger, ghost: c.primary }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        kind === 'danger' && { borderWidth: 1, borderColor: c.danger },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const c = usePalette();
  const tint = color ?? c.primary;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? tint : c.surfaceAlt,
          borderColor: selected ? tint : c.border,
        },
      ]}>
      <Text style={{ color: selected ? '#fff' : c.text, fontWeight: '600', fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: c.border, color: c.text },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}

export function Row({
  children,
  style,
  gap = space.sm,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T variant="muted" style={{ textAlign: 'center' }}>
        {body}
      </T>
      {action}
    </View>
  );
}

/** Plant photo, or a leafy monogram when there isn't one. */
export function PlantAvatar({ uri, name, size = 56 }: { uri: string | null; name: string; size?: number }) {
  const c = usePalette();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.surfaceAlt }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: c.primary, fontWeight: '800', fontSize: size * 0.4 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    padding: space.lg,
    paddingBottom: 120,
    gap: space.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.lg },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 16,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
});
