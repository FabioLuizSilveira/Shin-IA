import { ScrollView, RefreshControl, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { Loader, EmptyState, GradientButton } from "./ui";
import { theme } from "../theme";
import type { AsyncState } from "../lib/use-async-data";

// M23 — rule 13 (UX states): every connected screen gets
// loading/empty/error/offline/retry for free by wrapping its content in
// this component, instead of re-implementing the same four branches per
// screen.
export function AsyncScreen<T>({
  state,
  refreshing,
  onRetry,
  emptyTitle,
  emptySubtitle,
  children,
}: {
  state: AsyncState<T>;
  refreshing: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptySubtitle?: string;
  children: (data: T, source: "live" | "mock") => React.ReactNode;
}) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setOffline(netState.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (offline) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Sem conexão"
          subtitle="Verifique sua internet e tente novamente."
        />
        <GradientButton
          label="Tentar novamente"
          onPress={onRetry}
          style={{ marginHorizontal: theme.spacing.xl }}
        />
      </View>
    );
  }

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <EmptyState
          icon="alert-circle-outline"
          title={state.isAuthError ? "Sessão expirada" : "Não foi possível carregar"}
          subtitle={state.isAuthError ? "Entre novamente para continuar." : state.message}
        />
        {!state.isAuthError && (
          <GradientButton
            label="Tentar novamente"
            onPress={onRetry}
            style={{ marginHorizontal: theme.spacing.xl }}
          />
        )}
      </View>
    );
  }

  if (state.status === "empty") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRetry} />}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      >
        <EmptyState icon="file-tray-outline" title={emptyTitle} subtitle={emptySubtitle} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRetry} />}
    >
      {children(state.data, state.source)}
    </ScrollView>
  );
}
