import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { theme } from '@/src/theme';

function TabBg() {
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.surfaceSecondary }} />;
  }
  return <BlurView intensity={40} tint="dark" style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.75)' }} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brandSecondary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'web' ? theme.colors.surfaceSecondary : 'transparent',
          borderTopColor: theme.colors.border,
          height: 78,
          paddingTop: 8,
          paddingBottom: 20,
        },
        tabBarBackground: () => <TabBg />,
        tabBarLabelStyle: { fontFamily: theme.text, fontSize: 10.5, fontWeight: '600' },
      }}>
      <Tabs.Screen name="operations" options={{ title: 'Operações', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="assets" options={{ title: 'Ativos', tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
      <Tabs.Screen name="tracking" options={{ title: 'Tracking', tabBarIcon: ({ color, size }) => <Ionicons name="navigate" size={size} color={color} /> }} />
      <Tabs.Screen name="financial" options={{ title: 'Financeiro', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu', tabBarIcon: ({ color, size }) => <Ionicons name="apps" size={size} color={color} /> }} />
    </Tabs>
  );
}
