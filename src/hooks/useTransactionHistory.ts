/**
 * useTransactionHistory — fetches recent credit_transactions for the
 * authenticated user, with optional pagination.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreditTransaction {
  id: string;
  transaction_type: string; // 'search_debit' | 'purchase_credit' | 'monthly_grant' | 'adjustment' …
  source_type: string;
  source_id: string | null;
  amount: number;
  bucket: string; // 'monthly' | 'purchased'
  balance_before: number;
  balance_after: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface UseTransactionHistoryResult {
  transactions: CreditTransaction[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

const PAGE_SIZE = 20;

export function useTransactionHistory(): UseTransactionHistoryResult {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: err, count } = await supabase
        .from("credit_transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (err) throw err;

      const mapped: CreditTransaction[] = (data ?? []).map((row) => ({
        id: row.id,
        transaction_type: row.transaction_type,
        source_type: row.source_type,
        source_id: row.source_id ?? null,
        amount: row.amount,
        bucket: row.bucket,
        balance_before: row.balance_before,
        balance_after: row.balance_after,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
        created_at: row.created_at,
      }));

      setTransactions((prev) =>
        pageIndex === 0 ? mapped : [...prev, ...mapped]
      );

      const total = count ?? 0;
      setHasMore(from + mapped.length < total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage);
  }, [page, fetchPage]);

  return { transactions, loading, error, hasMore, loadMore };
}
