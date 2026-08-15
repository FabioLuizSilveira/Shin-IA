import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable, KeyboardAvoidingView, Platform, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/auth';

type Mode = 'landing' | 'login' | 'register';

export default function Index() {
  const router = useRouter();
  const { login, register, user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('landing');
  const [role, setRole] = useState<'locador' | 'locatario'>('locatario');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading || user) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }

  const submit = async () => {
    setError(null); setSubmitting(true);
    try {
      const u = mode === 'login'
        ? await login(email.trim(), password)
        : await register({ name: name.trim(), email: email.trim(), password, role, phone });
      if (u.role === 'locador') router.replace('/(locador)/dashboard');
      else router.replace('/(locatario)/home');
    } catch (e: any) {
      setError(e?.message || 'Erro');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async (r: 'locador' | 'locatario') => {
    setError(null); setSubmitting(true);
    try {
      const u = await login(r === 'locador' ? 'locador@demo.com' : 'locatario@demo.com', 'demo1234');
      if (u.role === 'locador') router.replace('/(locador)/dashboard');
      else router.replace('/(locatario)/home');
    } catch (e: any) {
      setError(e?.message || 'Erro');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceInverse }}>
      <ImageBackground
        source={{ uri: 'https://images.pexels.com/photos/29566884/pexels-photo-29566884.jpeg' }}
        style={styles.bg}
        imageStyle={{ opacity: 0.85 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(28,28,30,0.5)', 'rgba(28,28,30,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.brandBox}>
                <View style={styles.logoCircle}>
                  <Ionicons name="car-sport" size={28} color={theme.colors.onBrandPrimary} />
                </View>
                <Text style={styles.brandTitle}>Shinã I.A.</Text>
                <Text style={styles.brandSub}>Gestão inteligente de aluguel de carros — Locador & Locatário</Text>
              </View>

              {mode === 'landing' && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Bem-vindo</Text>
                  <Text style={styles.cardSub}>Entre ou crie sua conta para gerenciar sua frota ou seus veículos alugados.</Text>
                  <Pressable testID="go-login-btn" style={[styles.primaryBtn]} onPress={() => setMode('login')}>
                    <Text style={styles.primaryBtnText}>Entrar</Text>
                  </Pressable>
                  <Pressable testID="go-register-btn" style={styles.secondaryBtn} onPress={() => setMode('register')}>
                    <Text style={styles.secondaryBtnText}>Criar conta</Text>
                  </Pressable>
                  <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>Demonstração</Text><View style={styles.dividerLine} /></View>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Pressable testID="demo-locador-btn" style={[styles.demoBtn]} onPress={() => handleDemo('locador')}>
                      <Ionicons name="briefcase-outline" size={16} color={theme.colors.onBrandTertiary} />
                      <Text style={styles.demoText}>Sou Locador</Text>
                    </Pressable>
                    <Pressable testID="demo-locatario-btn" style={[styles.demoBtn]} onPress={() => handleDemo('locatario')}>
                      <Ionicons name="key-outline" size={16} color={theme.colors.onBrandTertiary} />
                      <Text style={styles.demoText}>Sou Locatário</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {(mode === 'login' || mode === 'register') && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
                    <Pressable onPress={() => setMode('landing')} testID="back-landing-btn">
                      <Ionicons name="close" size={22} color={theme.colors.onSurfaceTertiary} />
                    </Pressable>
                  </View>

                  {mode === 'register' && (
                    <>
                      <View style={styles.roleSwitch}>
                        <Pressable
                          testID="role-locatario-btn"
                          style={[styles.roleBtn, role === 'locatario' && styles.roleBtnActive]}
                          onPress={() => setRole('locatario')}>
                          <Text style={[styles.roleText, role === 'locatario' && styles.roleTextActive]}>Locatário</Text>
                        </Pressable>
                        <Pressable
                          testID="role-locador-btn"
                          style={[styles.roleBtn, role === 'locador' && styles.roleBtnActive]}
                          onPress={() => setRole('locador')}>
                          <Text style={[styles.roleText, role === 'locador' && styles.roleTextActive]}>Locador</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        testID="name-input"
                        value={name}
                        onChangeText={setName}
                        placeholder="Nome completo"
                        placeholderTextColor={theme.colors.onSurfaceTertiary}
                        style={styles.input}
                      />
                      <TextInput
                        testID="phone-input"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Telefone (opcional)"
                        placeholderTextColor={theme.colors.onSurfaceTertiary}
                        style={styles.input}
                        keyboardType="phone-pad"
                      />
                    </>
                  )}

                  <TextInput
                    testID="email-input"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="E-mail"
                    placeholderTextColor={theme.colors.onSurfaceTertiary}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    testID="password-input"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Senha"
                    placeholderTextColor={theme.colors.onSurfaceTertiary}
                    style={styles.input}
                    secureTextEntry
                  />
                  {error && <Text style={styles.errorText}>{error}</Text>}

                  <Pressable testID="submit-auth-btn" style={styles.primaryBtn} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> :
                      <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>}
                  </Pressable>

                  <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
                    <Text style={styles.switchLink}>
                      {mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  bg: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  brandBox: { alignItems: 'flex-start', marginBottom: theme.spacing.lg },
  logoCircle: {
    width: 52, height: 52, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md,
  },
  brandTitle: { color: '#fff', fontSize: 32, fontWeight: '500', letterSpacing: -0.5 },
  brandSub: { color: 'rgba(255,255,255,0.75)', fontSize: theme.font.base, marginTop: 4 },
  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cardTitle: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface },
  cardSub: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.base },
  primaryBtn: {
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: theme.colors.onBrandPrimary, fontWeight: '500', fontSize: theme.font.lg },
  secondaryBtn: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: theme.colors.onSurface, fontWeight: '500', fontSize: theme.font.lg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginVertical: theme.spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm },
  demoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.colors.brandTertiary, paddingVertical: 12, borderRadius: theme.radius.md,
  },
  demoText: { color: theme.colors.onBrandTertiary, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleSwitch: {
    flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4,
  },
  roleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  roleBtnActive: { backgroundColor: theme.colors.brandPrimary },
  roleText: { color: theme.colors.onSurfaceTertiary, fontWeight: '500' },
  roleTextActive: { color: theme.colors.onBrandPrimary },
  input: {
    backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: 12, color: theme.colors.onSurface, fontSize: theme.font.lg,
  },
  errorText: { color: theme.colors.error, fontSize: theme.font.sm },
  switchLink: { color: theme.colors.brandPrimary, textAlign: 'center', marginTop: 4, fontWeight: '500' },
});
