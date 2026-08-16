import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';
import { T } from '@/src/components/ui';

// Apple login stays hidden until the Apple provider is configured in Supabase.
const SHOW_APPLE = false;

export default function Login() {
  const router = useRouter();
  const { user, loading, signInWith, signInDemo, supabaseReady } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading || user) {
    return (
      <View style={styles.center}><ActivityIndicator color={theme.colors.brandSecondary} /></View>
    );
  }

  const oauth = async (p: 'google' | 'apple') => {
    setError(null); setBusy(p);
    try { await signInWith(p); }
    catch (e: any) { setError(e?.message || 'Falha no login'); }
    finally { setBusy(null); }
  };

  const demo = async () => {
    setBusy('demo');
    await signInDemo();
    router.replace('/(tabs)/operations');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1677784976154-816c3ceca511?w=1200' }}
        style={StyleSheet.absoluteFill as any}
        imageStyle={{ opacity: 0.6 }}
      >
        <LinearGradient colors={['rgba(15,23,42,0.4)', 'rgba(15,23,42,0.85)', '#0F172A']} style={StyleSheet.absoluteFill} />
      </ImageBackground>

      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: theme.spacing.xl }}>
        <View style={{ marginTop: theme.spacing.xxl }}>
          <View style={styles.logoRow}>
            <LinearGradient colors={theme.gradients.neural} style={styles.logoMark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="pulse" size={26} color="#fff" />
            </LinearGradient>
            <Text style={[T.display(theme.font.xxl)]}>Shinã <Text style={{ color: theme.colors.brandSecondary }}>I.A.</Text></Text>
          </View>
        </View>

        <View>
          <Text style={[T.display(40), { lineHeight: 46 }]}>Comando{'\n'}inteligente{'\n'}da sua frota</Text>
          <Text style={[T.text(theme.font.lg, theme.colors.onSurfaceTertiary), { marginTop: theme.spacing.md, maxWidth: 320 }]}>
            Operações, ativos, tracking e financeiro em um só painel, potencializados por IA.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {!supabaseReady && (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.brandSecondary} />
              <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary), { flex: 1 }]}>
                Supabase ainda não configurado. Use o modo demonstração para explorar o app.
              </Text>
            </View>
          )}
          {!!error && <Text style={[T.text(theme.font.sm, theme.colors.error)]}>{error}</Text>}

          <Pressable testID="google-login-btn" style={styles.oauthBtn} onPress={() => oauth('google')} disabled={!!busy}>
            {busy === 'google' ? <ActivityIndicator color="#0F172A" /> : (
              <>
                <Ionicons name="logo-google" size={18} color="#0F172A" />
                <Text style={styles.oauthText}>Continuar com Google</Text>
              </>
            )}
          </Pressable>

          <Pressable testID="apple-login-btn" style={[styles.oauthBtn, { backgroundColor: '#000', display: SHOW_APPLE ? 'flex' : 'none' }]} onPress={() => oauth('apple')} disabled={!!busy || !SHOW_APPLE}>
            {busy === 'apple' ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={[styles.oauthText, { color: '#fff' }]}>Continuar com Apple</Text>
              </>
            )}
          </Pressable>

          <Pressable testID="demo-login-btn" style={styles.demoBtn} onPress={demo} disabled={!!busy}>
            <Text style={[T.text(theme.font.base, theme.colors.brandSecondary), { fontWeight: '600' }]}>
              Entrar em modo demonstração →
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  logoMark: { width: 48, height: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  oauthBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', paddingVertical: 15, borderRadius: theme.radius.pill },
  oauthText: { fontFamily: theme.display, fontSize: theme.font.lg, fontWeight: '600', color: '#0F172A' },
  demoBtn: { alignItems: 'center', paddingVertical: 12 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
});
