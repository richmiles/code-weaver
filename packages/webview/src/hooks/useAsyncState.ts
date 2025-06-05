import { useState, useCallback } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export const useAsyncState = <T>(initialData: T | null = null) => {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null
  });

  const execute = useCallback(async (asyncFunction: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await asyncFunction();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: errorObj }));
      throw errorObj;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: initialData, loading: false, error: null });
  }, [initialData]);

  const setData = useCallback((data: T) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: Error) => {
    setState(prev => ({ ...prev, error, loading: false }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
    setError
  };
};