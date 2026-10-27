import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/fonts';
import { num } from '@/lib/format';
import { weekdayOfDay, weekdayShort } from '@/lib/dates';
import { useToast } from '@/store/toast';

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryBtn,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.8 },
        style,
      ]}
    >
      <Text style={styles.primaryBtnText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondaryBtn,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={styles.secondaryBtnText}>{title}</Text>
    </Pressable>
  );
}

export function GhostButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.ghostBtnText}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

export const CloseIcon = ({ size = 22, color = colors.ink }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const DeleteIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z" />
    <Path d="M13 10l4 4M17 10l-4 4" />
  </Svg>
);

export function Chip({
  label,
  dashed,
  onPress,
}: {
  label: string;
  dashed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        dashed && styles.chipDashed,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, dashed && { color: colors.soft }]}>{label}</Text>
    </Pressable>
  );
}

export function Note({
  tone = 'neutral',
  children,
  style,
}: {
  tone?: 'good' | 'adjust' | 'neutral';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'good' ? colors.goodBg : tone === 'adjust' ? colors.warmBg : colors.tint;
  const fg = tone === 'good' ? colors.good : tone === 'adjust' ? colors.warm : colors.ink;
  return (
    <View style={[styles.note, { backgroundColor: bg }, style]}>
      <Text style={[styles.noteText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function HugeNumber({
  value,
  size = 72,
  style,
}: {
  value: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const text = num(value);
  return (
    <View style={style} accessibilityLabel={`₹${text}`}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontFamily: fonts.display500,
          fontSize: size,
          color: colors.ink,
          letterSpacing: -1,
          fontVariant: ['tabular-nums'],
        }}
      >
        <Text style={{ color: colors.faint }}>₹</Text>
        {text}
      </Text>
    </View>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={styles.keypad}>
      {[0, 3, 6, 9].map((rowStart) => (
        <View key={rowStart} style={styles.keypadRow}>
          {KEYS.slice(rowStart, rowStart + 3).map((k) => (
            <Pressable
              key={k}
              onPress={() => onKey(k)}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete' : k}
              style={({ pressed }) => [styles.keypadKey, pressed && { opacity: 0.7 }]}
            >
              {k === 'del' ? <DeleteIcon /> : <Text style={styles.keypadText}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export interface WeekDay {
  day: number;
  status: 'closed' | 'estimated' | 'today' | 'future';
}

export function weekWindow(currentDay: number, totalDays: number): number[] {
  const count = Math.min(7, totalDays);
  let first = currentDay - 3;
  first = Math.min(first, totalDays - count + 1);
  first = Math.max(first, 1);
  return Array.from({ length: count }, (_, i) => first + i);
}

export function WeekRow({ days, startDate }: { days: WeekDay[]; startDate: string }) {
  return (
    <View style={styles.weekRow}>
      {days.map((d) => {
        const wd = weekdayShort(weekdayOfDay(startDate, d.day));
        const isClosed = d.status === 'closed';
        const isEst = d.status === 'estimated';
        const isToday = d.status === 'today';
        return (
          <View key={d.day} style={styles.weekItem}>
            <View
              style={[
                styles.weekCircle,
                isClosed && { backgroundColor: colors.ink },
                isEst && {
                  backgroundColor: colors.tint,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.faint,
                },
                isToday && { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.bg },
              ]}
            >
              <Text
                style={[
                  styles.weekLetter,
                  isClosed && { color: '#FFFFFF' },
                  isEst && { color: colors.soft },
                  isToday && { color: colors.ink },
                  d.status === 'future' && { color: colors.faint },
                ]}
              >
                {wd[0]}
              </Text>
            </View>
            <Text style={styles.weekDayNum}>{d.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

export type Tab = 'today' | 'insights' | 'categories';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'insights', label: 'Insights' },
  { id: 'categories', label: 'Categories' },
];

export function TabBar({
  tab,
  onChange,
  bottomInset,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  bottomInset: number;
}) {
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tabItem}
          >
            <View style={[styles.tabIndicator, active && { backgroundColor: colors.ink }]} />
            <Text style={[styles.tabLabel, active ? { color: colors.ink } : { color: colors.faint }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toast({ topInset }: { topInset: number }) {
  const { message, tone } = useToast();
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { top: topInset + 12 }]}>
      <View
        style={[
          styles.toastPill,
          tone === 'warm' ? { backgroundColor: colors.warmBg } : { backgroundColor: colors.ink },
        ]}
      >
        <Text style={[styles.toastText, tone === 'warm' ? { color: colors.warm } : { color: '#FFFFFF' }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{body}</Text>
          <View style={{ marginTop: 20, gap: 8 }}>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.warmBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.warmBtnText}>{confirmLabel}</Text>
            </Pressable>
            <SecondaryButton title="Cancel" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.sans600,
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.sans600,
    fontSize: 16,
    color: colors.ink,
  },
  ghostBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontFamily: fonts.sans500,
    fontSize: 15,
    color: colors.soft,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDashed: {
    borderStyle: 'dashed',
    borderColor: colors.faint,
  },
  chipText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
    color: colors.ink,
  },
  note: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteText: {
    fontFamily: fonts.sans400,
    fontSize: 14,
    lineHeight: 20,
  },
  keypad: {
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadKey: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadText: {
    fontFamily: fonts.display500,
    fontSize: 28,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekItem: {
    alignItems: 'center',
    gap: 4,
  },
  weekCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLetter: {
    fontFamily: fonts.sans600,
    fontSize: 12,
  },
  weekDayNum: {
    fontFamily: fonts.sans400,
    fontSize: 11,
    color: colors.faint,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  tabItem: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    gap: 4,
  },
  tabIndicator: {
    width: 24,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontFamily: fonts.sans600,
    fontSize: 13,
  },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  toastPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: {
    fontFamily: fonts.sans500,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,27,75,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  modalTitle: {
    fontFamily: fonts.sans600,
    fontSize: 17,
    color: colors.ink,
  },
  modalBody: {
    fontFamily: fonts.sans400,
    fontSize: 15,
    lineHeight: 22,
    color: colors.soft,
    marginTop: 8,
  },
  warmBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.warmBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmBtnText: {
    fontFamily: fonts.sans600,
    fontSize: 16,
    color: colors.warm,
  },
});
