import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ApiError } from "./shinaia-api";

// M23 — shared loading/empty/error/retry state for every screen, instead of
// each screen hand-rolling its own. Refetches on focus (React Navigation's
// useFocusEffect), matching the Emergent screens' original
// expo-router useFocusEffect behavior 1:1.
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string; isAuthError: boolean }
  | { status: "empty" }
  | { status: "ready"; data: T; source: "live" | "mock" };

export function useAsyncData<T>(
  fetcher: () => Promise<{ data: T; source: "live" | "mock" }>,
  isEmpty: (data: T) => boolean = (data) => Array.isArray(data) && data.length === 0,
) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setState({ status: "loading" });
      try {
        const result = await fetcher();
        setState(
          isEmpty(result.data)
            ? { status: "empty" }
            : { status: "ready", data: result.data, source: result.source },
        );
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Erro inesperado",
          isAuthError: err instanceof ApiError && (err.status === 401 || err.status === 403),
        });
      } finally {
        setRefreshing(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [fetcher],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  return { state, refreshing, reload: load };
}
