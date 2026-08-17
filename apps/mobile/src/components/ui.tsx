// M22 — ported from the Emergent frontend
// (frontend/src/components/ui.tsx on origin/feat/emergent-mobile-integration),
// adapted only for this repo's asset path and import alias (no visual/logic
// changes). This is the shared design-system primitive layer for the
// tenant_user experience per the ADR's "preserve design/components" decision.
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

const SYMBOL = require("../../assets/shina-symbol-alpha.png");

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <Image source={SYMBOL} style={{ width: size, height: size * 1.16 }} contentFit="contain" />
  );
}

export const T = {
  display: (size = theme.font.xl): TextStyle => ({
    fontFamily: theme.display,
    fontSize: size,
    color: theme.colors.onSurface,
  }),
  text: (size = theme.font.base, color = theme.colors.onSurfaceSecondary): TextStyle => ({
    fontFamily: theme.text,
    fontSize: size,
    color,
  }),
};

const TONES: Record<string, string> = {
  active: theme.colors.success,
  healthy: theme.colors.success,
  valid: theme.colors.success,
  success: theme.colors.success,
  on_route: theme.colors.brandSecondary,
  available: theme.colors.success,
  paid: theme.colors.success,
  alert: theme.colors.error,
  warning: theme.colors.warning,
  error: theme.colors.error,
  expiring: theme.colors.warning,
  maintenance: theme.colors.warning,
  pending: theme.colors.warning,
  inadimplente: theme.colors.error,
  idle: theme.colors.muted,
  off: theme.colors.muted,
  info: theme.colors.brandSecondary,
  brand: theme.colors.brandPrimary,
  finalizado: theme.colors.muted,
  completed: theme.colors.muted,
  rented: theme.colors.brandSecondary,
  muted: theme.colors.muted,
};
const LABELS: Record<string, string> = {
  active: "Ativo",
  alert: "Alerta",
  maintenance: "Manutenção",
  idle: "Parado",
  on_route: "Em rota",
  available: "Disponível",
  off: "Folga",
  pending: "Pendente",
  valid: "Válido",
  expiring: "Expirando",
  paid: "Pago",
  healthy: "Saudável",
  rented: "Alugado",
  finalizado: "Finalizado",
  completed: "Concluído",
  inadimplente: "Inadimplente",
};

export function Chip({ status, label }: { status: string; label?: string }) {
  const color = TONES[status] || theme.colors.muted;
  return (
    <View style={[styles.chip, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, { color }]}>{label || LABELS[status] || status}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  brand,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  brand?: boolean;
}) {
  return (
    <View style={styles.header}>
      {brand && (
        <View style={styles.headerMark}>
          <BrandMark size={26} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        {!!subtitle && (
          <Text
            style={[
              T.text(theme.font.sm, theme.colors.brandSecondary),
              { letterSpacing: 1, textTransform: "uppercase" },
            ]}
          >
            {subtitle}
          </Text>
        )}
        <Text style={[T.display(theme.font.xxxl), { marginTop: 2 }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function BackHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.backHeader}>
      <View style={styles.headerMark}>
        <BrandMark size={24} />
      </View>
      <Text style={[T.display(theme.font.xxl), { flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Loader() {
  return (
    <View style={{ paddingVertical: theme.spacing.xxl, alignItems: "center" }}>
      <ActivityIndicator color={theme.colors.brandSecondary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={theme.colors.brandSecondary} />
      </View>
      <Text style={[T.display(theme.font.lg)]}>{title}</Text>
      {!!subtitle && <Text style={[T.text(), { textAlign: "center" }]}>{subtitle}</Text>}
    </View>
  );
}

export function GradientButton({
  label,
  onPress,
  testID,
  icon,
  colors,
  style,
  loading,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  colors?: readonly [string, string, ...string[]];
  style?: ViewStyle;
  loading?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading}
      style={[{ borderRadius: theme.radius.pill, overflow: "hidden" }, style]}
    >
      <LinearGradient
        colors={colors || theme.gradients.neural}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradBtn}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
            <Text style={styles.gradBtnText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Sparkbar({
  data,
  color,
  height = 44,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  return (
    <View style={[styles.spark, { height }]}>
      {data.map((v, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <View
            style={{
              width: "62%",
              height: Math.max(4, (v / max) * height),
              backgroundColor: color || theme.colors.brandSecondary,
              borderRadius: 3,
              opacity: 0.55 + (v / max) * 0.45,
            }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: theme.text, fontSize: theme.font.sm, fontWeight: "600" },
  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerMark: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  empty: { alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandSecondary + "1A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  gradBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  gradBtnText: {
    color: "#fff",
    fontFamily: theme.display,
    fontSize: theme.font.lg,
    fontWeight: "600",
  },
  spark: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
});
