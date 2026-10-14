import { useEffect, useState } from "react";
import type { Product } from "../../domain/models";
import { catalogByCodes } from "./products.api";

/** Load alternate photos only while editing a catalog product. Never persist browser copies. */
export function useCatalogPhotos(product?: Product) {
  const code = product?.code;
  const hasPhotos = Boolean(product?.images?.length);
  const [result, setResult] = useState<Product>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setResult(undefined);
    setError(false);
    if (!code || hasPhotos) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    catalogByCodes([code], controller.signal)
      .then((products) => {
        if (!controller.signal.aborted)
          setResult(products.find((item) => item.code === code));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code, hasPhotos, attempt]);
  return {
    product: result?.code === code ? result : product,
    loading,
    error,
    retry: () => setAttempt((current) => current + 1),
  };
}
