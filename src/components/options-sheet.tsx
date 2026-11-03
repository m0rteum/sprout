import { Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space, usePalette } from '@/theme';

import { T } from './ui';

export interface SheetOption {
  label: string;
  hint?: string;
  destructive?: boolean;
  run: () => void;
}

/** A bottom sheet of choices that looks the same on iOS, Android and web. */
export function OptionsSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  onClose: () => void;
}) {
  const c = usePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.surface }]}>
          <Pressable>
            <T variant="heading" style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
              {title}
            </T>
            {options.map((o) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  o.run();
                }}
                style={({ pressed }) => [
                  styles.option,
                  { borderTopColor: c.border, backgroundColor: pressed ? c.surfaceAlt : undefined },
                ]}>
                <T color={o.destructive ? c.danger : undefined} style={{ fontWeight: '600' }}>
                  {o.label}
                </T>
                {o.hint ? <T variant="small">{o.hint}</T> : null}
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.option, { borderTopColor: c.border }]}>
              <T variant="muted" style={{ textAlign: 'center', fontWeight: '600' }}>
                Cancel
              </T>
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  option: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
