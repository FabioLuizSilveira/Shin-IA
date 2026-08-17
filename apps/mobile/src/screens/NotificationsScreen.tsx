import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T, GradientButton } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type NotificationItem } from "../lib/shinaia-api";

// M23 — GET/PATCH /api/mobile/notifications (customer/operator) or
// GET/PATCH /api/notifications (tenant_user, staff broadcast inbox — same
// shape, different path per the persona docs). Mark-read is a real mutation;
// ownership is enforced entirely server-side (recipient_external_ref match),
// this screen never decides whose notification it is.
export function NotificationsScreen() {
  const fetcher = useCallback(() => shinaia.notifications(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  async function markRead(id: string) {
    try {
      await shinaia.markNotificationsRead([id]);
      void reload(true);
    } catch {
      // Non-critical mutation — a failed mark-read just leaves the item
      // showing as unread; no need to interrupt the user with an alert.
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Notificações" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhuma notificação"
      >
        {(notifications: NotificationItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {notifications.some((n) => n.status !== "read") && (
              <GradientButton
                label="Marcar todas como lidas"
                onPress={() =>
                  void shinaia.markNotificationsRead(undefined, true).then(() => reload(true))
                }
              />
            )}
            {notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => (n.status !== "read" ? void markRead(n.id) : undefined)}
              >
                <Card style={n.status === "read" ? { opacity: 0.6 } : undefined}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={T.display(theme.font.base)}>{n.subject}</Text>
                    {n.priority === "high" || n.priority === "critical" ? (
                      <Chip status="alert" />
                    ) : null}
                  </View>
                  <Text style={T.text()}>{n.body}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
