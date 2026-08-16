import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase, supabaseConfigured } from '@/src/lib/supabase';
import { theme } from '@/src/theme';
import { T } from '@/src/components/ui';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let done = false;

    // Surface any provider error passed back in the URL (web only).
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      const errDesc = u.searchParams.get('error_description') || u.hash.match(/error_description=([^&]+)/)?.[1];
      if (errDesc) setError(decodeURIComponent(errDesc.replace(/\+/g, ' ')));
    }

    if (!supabaseConfigured || !supabase) {
      router.replace('/');
      return;
    }

    const finish = () => { if (!done) { done = true; router.replace('/(tabs)/operations'); } };

    // If detectSessionInUrl already produced a session, react to it.
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, s: any) => {
      if (s) finish();
    });

    // Poll for the session for a few seconds while the code<->session exchange settles.
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      if (tries === 3) setSlow(true);
      const { data } = await supabase.auth.getSession();
      if (data.session) { clearInterval(iv); finish(); }
      else if (tries >= 12) {
        clearInterval(iv);
        if (!done) setError((prev) => prev || 'Não foi possível concluir o login. Verifique as Redirect URLs no Supabase e tente novamente.');
      }
    }, 700);

    return () => { done = true; clearInterval(iv); sub?.subscription?.unsubscribe?.(); };
  }, [router]);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.box}>
          <View style={styles.errIcon}><Ionicons name="alert-circle" size={30} color={theme.colors.error} /></View>
          <Text style={[T.display(theme.font.xl), { textAlign: 'center' }]}>Falha no login</Text>
          <Text style={[T.text(theme.font.base, theme.colors.onSurfaceTertiary), { textAlign: 'center' }]}>{error}</Text>
          <Pressable testID="callback-back-btn" style={styles.btn} onPress={() => router.replace('/')}>
            <Text style={[T.text(theme.font.base, '#fff'), { fontWeight: '600' }]}>Voltar ao login</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.box}>
          <ActivityIndicator color={theme.colors.brandSecondary} />
          <Text style={[T.text(theme.font.base, theme.colors.onSurfaceTertiary)]}>{slow ? 'Concluindo autenticação…' : 'Entrando…'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, padding: theme.spacing.xl },
  box: { alignItems: 'center', gap: theme.spacing.md, maxWidth: 320 },
  errIcon: { width: 60, height: 60, borderRadius: theme.radius.pill, backgroundColor: theme.colors.error + '22', alignItems: 'center', justifyContent: 'center' },
  btn: { backgroundColor: theme.colors.brandPrimary, paddingHorizontal: theme.spacing.xl, paddingVertical: 12, borderRadius: theme.radius.pill, marginTop: theme.spacing.sm },
});
