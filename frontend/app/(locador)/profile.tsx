import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { Card, ScreenHeader, PrimaryButton } from '@/src/components/ui';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const doLogout = async () => { await logout(); router.replace('/'); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }} edges={['top']}>
      <ScreenHeader title="Perfil" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.sub}>{user?.email}</Text>
            <View style={styles.roleTag}><Text style={styles.roleTagText}>{user?.role === 'locador' ? 'Locador' : 'Locatário'}</Text></View>
          </View>
        </Card>
        <Card>
          <Row icon="mail-outline" label="E-mail" value={user?.email || '—'} />
          <Row icon="call-outline" label="Telefone" value={user?.phone || '—'} />
        </Card>
        <PrimaryButton testID="logout-btn" label="Sair" onPress={doLogout} style={{ backgroundColor: theme.colors.error }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={theme.colors.onBrandTertiary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.onBrandPrimary, fontSize: 28, fontWeight: '500' },
  name: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary },
  roleTag: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radius.pill, marginTop: 4 },
  roleTagText: { color: theme.colors.onBrandTertiary, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm },
  rowValue: { color: theme.colors.onSurface, fontSize: theme.font.lg, fontWeight: '500' },
});
