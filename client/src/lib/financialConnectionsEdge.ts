import { callEdgeFunctionJson } from "@/lib/edgeFunctions";

export type ConnectedAccountRow = {
  id: string;
  institutionName: string | null;
  last4: string | null;
  status: string | null;
};

export async function getConnectedAccountsEdge(stripeCustomerId: string) {
  return callEdgeFunctionJson<{ accounts: ConnectedAccountRow[]; error?: string }>(
    "get-connected-accounts",
    { json: { stripeCustomerId } },
  );
}

export async function createFinancialConnectionSessionEdge(stripeCustomerId: string) {
  return callEdgeFunctionJson<{ clientSecret?: string; error?: string }>(
    "create-financial-connection-session",
    { json: { stripeCustomerId } },
  );
}

export async function disconnectFinancialAccountEdge(stripeCustomerId: string, accountId: string) {
  return callEdgeFunctionJson<{ success?: boolean; error?: string }>("disconnect-financial-account", {
    json: { stripeCustomerId, accountId },
  });
}
