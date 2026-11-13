import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "./api";

interface FetchState<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
  reload: () => void;
}

export function useFetch<T>(path: string | null): FetchState<T> {
  const [requestNumber, setRequestNumber] = useState(0);
  const [state, setState] = useState<{
    path: string | null;
    requestNumber: number;
    data: T | null;
    error: ApiError | Error | null;
    loading: boolean;
  }>({ path, requestNumber: 0, data: null, error: null, loading: path !== null });

  useEffect(() => {
    if (path === null) return;

    let cancelled = false;
    api<T>(path)
      .then((result) => {
        if (!cancelled) setState({ path, requestNumber, data: result, error: null, loading: false });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          const error = reason instanceof ApiError || reason instanceof Error ? reason : new Error("Request failed");
          setState({ path, requestNumber, data: null, error, loading: false });
        }
      })

    return () => {
      cancelled = true;
    };
  }, [path, requestNumber]);

  const reload = useCallback(() => setRequestNumber((number) => number + 1), []);
  const matchesRequest = state.path === path && state.requestNumber === requestNumber;
  return {
    data: path !== null && matchesRequest ? state.data : null,
    error: path !== null && matchesRequest ? state.error : null,
    loading: path !== null && (!matchesRequest || state.loading),
    reload,
  };
}
