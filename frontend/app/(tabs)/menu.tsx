import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { Card, ScreenHeader, T } from '@/src/components/ui';

const MODULES = [
  { id: 'operators', label: 'Operadores', desc: 'Motoristas e equipe', icon: 'people', route: '/module/operators', color: theme.colors.brandPrimary },
  { id: 'clients', label: 'Clientes', desc: 'Contas e contratos', icon: 'business', route: '/module/clients', color: theme.colors.brandSecondary },
  { id: 'contracts', label: 'Contratos', desc: 'Acordos ativos', icon: 'document-text', route: '/module/contracts', color: theme.colors.brandTertiary },
  { id: 'documents', label: 'Documentos', desc: 'Cofre de arquivos', icon: 'folder', route: '/module/documents', color: theme.colors.info },
  { id: 'notifications', label: 'Notificações', desc: 'Alertas e avisos', icon: 'notifications', route: '/module/notifications', color: theme.colors.warning },
];

export default function Menu() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const logout = async () => { await signOut(); router.replace('/'); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Menu" subtitle="Módulos" brand />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120, gap: theme.spacing.lg }}>
        {/* Profile */}
        <View style={styles.profile}>
          <LinearGradient colors={theme.gradients.neural} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pAvatar}>
            <Text style={styles.pAvatarText}>{user?.name?.charAt(0) || 'S'}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[T.display(theme.font.xl)]}>{user?.name}</Text>
            <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{user?.email}</Text>
            <View style={styles.providerTag}>
              <Ionicons name={user?.provider === 'apple' ? 'logo-apple' : user?.provider === 'google' ? 'logo-google' : 'flask'} size={11} color={theme.colors.brandSecondary} />
              <Text style={[T.text(theme.font.sm, theme.colors.brandSecondary)]}>{user?.provider === 'demo' ? 'Demonstração' : user?.provider}</Text>
            </View>
          </View>
        </View>

        {/* Modules */}
        <View style={{ gap: theme.spacing.sm }}>
          {MODULES.map(m => (
            <Pressable key={m.id} testID={`module-${m.id}`} onPress={() => router.push(m.route as any)}>
              <Card style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: m.color + '22' }]}>
                  <Ionicons name={m.icon as any} size={20} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.display(theme.font.lg)]}>{m.label}</Text>
                  <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{m.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </Card>
            </Pressable>
          ))}
        </View>

        <Pressable testID="logout-btn" onPress={logout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
          <Text style={[T.text(theme.font.base, theme.colors.error), { fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  profile: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  pAvatar: { width: 56, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  pAvatarText: { fontFamily: theme.display, fontSize: theme.font.xxl, color: '#fff' },
  providerTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  rowIcon: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing.md, marginTop: theme.spacing.sm },
});
