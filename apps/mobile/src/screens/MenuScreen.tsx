import { View, Text, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Card, ScreenHeader, T } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import type { RootStackParamList } from "../navigation";

const ITEMS: {
  key: keyof RootStackParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "Clients", label: "Clientes", icon: "people-outline" },
  { key: "Operators", label: "Operadores", icon: "person-outline" },
  { key: "Contracts", label: "Contratos", icon: "document-text-outline" },
  { key: "Notifications", label: "Notificações", icon: "notifications-outline" },
];

// M23 — module hub for screens that aren't tabs (mirrors the Emergent
// frontend's menu.tsx module list). Tracking/Documents-as-a-standalone-inbox
// are deliberately absent here — see MOBILE_KNOWN_ISSUES.md for why
// (registered gaps, not silently dropped).
export function MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuth();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Menu" brand />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {ITEMS.map((item) => (
          <Pressable key={item.key} onPress={() => navigation.navigate(item.key as never)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <Ionicons name={item.icon} size={20} color={theme.colors.brandSecondary} />
              <Text style={T.text(theme.font.base, theme.colors.onSurface)}>{item.label}</Text>
            </Card>
          </Pressable>
        ))}
        <Pressable onPress={() => void signOut()}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
            <Text style={T.text(theme.font.base, theme.colors.error)}>Sair</Text>
          </Card>
        </Pressable>
      </View>
    </ScrollView>
  );
}
