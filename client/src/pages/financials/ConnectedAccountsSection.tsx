import { useCallback, useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { FeatureGate } from "@/components/gates/FeatureGate";
import { Card, CardBody, CardHeader } from "@/components/settings/SettingsPrimitives";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabaseClient";
import {
  disconnectFinancialAccountEdge,
  getConnectedAccountsEdge,
  createFinancialConnectionSessionEdge,
  type ConnectedAccountRow,
} from "@/lib/financialConnectionsEdge";
import { isStripeConfigured, stripePromise } from "@/lib/stripe";
import { runFinancialConnectionsLinkForSignedInUser } from "@/lib/runFinancialConnectionsCollect";
import { syncBankTransactionsFromStripe, syncFinancialConnections } from "@/api/financialConnections";

type CollectFcFn = (opts: { clientSecret: string }) => Promise<{
  error?: { message?: string };
  financialConnectionsSession?: { accounts?: { id: string }[] };
}>;

function maskLast4(last4: string | null): string {
  if (!last4 || last4.length < 4) return "••••";
  return `•••• ${last4}`;
}

export function ConnectedAccountsSection() {
  const { stripeCustomerId } = useSubscription();
  const [accounts, setAccounts] = useState<ConnectedAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectBusy, setConnectBusy] = useState(false);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!stripeCustomerId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, errorMessage } = await getConnectedAccountsEdge(stripeCustomerId);
    if (errorMessage) {
      setError(errorMessage);
      setAccounts([]);
    } else {
      setAccounts(data?.accounts ?? []);
    }
    setLoading(false);
  }, [stripeCustomerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const afterLinkSuccess = useCallback(async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      await syncFinancialConnections(token).catch(() => {});
      await syncBankTransactionsFromStripe(token).catch(() => {});
    }
    await refresh();
  }, [refresh]);

  const connect = async () => {
    setError(null);
    if (!isStripeConfigured || !stripePromise) {
      setError("Stripe is not configured.");
      return;
    }

    setConnectBusy(true);
    try {
      if (stripeCustomerId) {
        const stripe = await stripePromise;
        if (!stripe) {
          setError("Stripe failed to load.");
          return;
        }
        const collect = stripe.collectFinancialConnectionsAccounts as unknown as CollectFcFn | undefined;
        if (typeof collect !== "function") {
          setError("Update @stripe/stripe-js to use bank linking.");
          return;
        }
        const { data, errorMessage } = await createFinancialConnectionSessionEdge(stripeCustomerId);
        if (errorMessage || !data?.clientSecret) {
          setError(errorMessage ?? "Could not start bank linking.");
          return;
        }
        const result = await collect.call(stripe, { clientSecret: data.clientSecret });
        if (result.error) {
          setError(result.error.message || "Bank linking was cancelled or failed.");
          return;
        }
        const linked = (result.financialConnectionsSession?.accounts?.length ?? 0) > 0;
        if (linked) await afterLinkSuccess();
        else await refresh();
        return;
      }

      if (!supabase) {
        setError("Sign in to link a bank account.");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("You need to be signed in.");
        return;
      }
      const out = await runFinancialConnectionsLinkForSignedInUser(token);
      if (out.errorMessage) {
        setError(out.errorMessage);
        return;
      }
      await afterLinkSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setConnectBusy(false);
    }
  };

  const disconnect = async (accountId: string) => {
    if (!stripeCustomerId) return;
    setDisconnectId(accountId);
    setError(null);
    try {
      const { errorMessage } = await disconnectFinancialAccountEdge(stripeCustomerId, accountId);
      if (errorMessage) {
        setError(errorMessage);
        return;
      }
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await syncFinancialConnections(token).catch(() => {});
        }
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed.");
    } finally {
      setDisconnectId(null);
    }
  };

  return (
    <FeatureGate feature="bankLink">
      <Card style={{ marginBottom: 24 }}>
        <CardHeader
          title="Connected accounts"
          desc="Bank accounts linked via Stripe Financial Connections for balances and transaction import."
        />
        <CardBody>
          <div className="mb-4 flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0ede8] dark:bg-[var(--bg-hover)]"
              aria-hidden
            >
              <Landmark size={20} strokeWidth={1.75} className="text-[#374151] dark:text-[var(--text-muted)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] leading-relaxed text-[#6b7280] dark:text-[var(--text-muted)]">
                Subscription billing uses a separate payment method. These connections are read-only for Financials.
              </p>
            </div>
          </div>

          {error ? (
            <div
              className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-[13px] text-[#9ca3af]">Loading linked accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="mb-4 text-[13px] leading-snug text-[#9ca3af]">
              No bank accounts linked yet. Connect a US account to import transactions into Financials.
            </p>
          ) : (
            <ul className="mb-4 grid list-none gap-3 p-0 sm:grid-cols-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm"
                >
                  <div className="mb-1 text-[15px] font-bold text-[var(--text-primary)]">
                    {a.institutionName || "Linked account"}
                  </div>
                  <div className="mb-3 font-mono text-[13px] text-[var(--text-muted)]">{maskLast4(a.last4)}</div>
                  {a.status ? (
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {a.status}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost text-[13px]"
                    disabled={disconnectId === a.id}
                    onClick={() => void disconnect(a.id)}
                  >
                    {disconnectId === a.id ? "Disconnecting…" : "Disconnect"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="btn btn-primary"
            disabled={connectBusy}
            onClick={() => void connect()}
          >
            {connectBusy ? "Opening Stripe…" : accounts.length > 0 ? "Link another bank" : "Link Bank"}
          </button>
        </CardBody>
      </Card>
    </FeatureGate>
  );
}
