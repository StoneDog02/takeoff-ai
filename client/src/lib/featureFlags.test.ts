import { describe, expect, it } from "@jest/globals";
import {
  getAllFeatureFlagsSet,
  getEnabledFeatures,
  hasFeature,
  type FeatureFlag,
  type UserSubscription,
} from "./featureFlags";

const CORE: FeatureFlag[] = [
  "projects",
  "schedule",
  "scopeOfWork",
  "taskDashboard",
  "workTypeRates",
  "budgetTracking",
];

const ESTIMATING: FeatureFlag[] = ["estimateBuilder", "lineItems", "markupControls"];

const PORTALS: FeatureFlag[] = ["subBidPortal", "clientApprovalPortal"];

function expectSetEqual(actual: Set<FeatureFlag>, expected: FeatureFlag[]) {
  expect([...actual].sort()).toEqual([...expected].sort());
}

describe("getEnabledFeatures", () => {
  it("core only: Core PM features, no modules", () => {
    const sub: UserSubscription = {
      tier: "core",
      addons: [],
      status: "active",
    };
    expectSetEqual(getEnabledFeatures(sub), [...CORE]);
  });

  it("plus tier: Core PM + estimating", () => {
    const sub: UserSubscription = {
      tier: "plus",
      addons: [],
      status: "active",
    };
    expectSetEqual(getEnabledFeatures(sub), [...CORE, ...ESTIMATING]);
  });

  it("pro tier: Core PM + estimating + portals", () => {
    const sub: UserSubscription = {
      tier: "pro",
      addons: [],
      status: "active",
    };
    expectSetEqual(getEnabledFeatures(sub), [...CORE, ...ESTIMATING, ...PORTALS]);
  });

  it("core + financials addon: Core PM + Financial Suite (stacking)", () => {
    const sub: UserSubscription = {
      tier: "core",
      addons: ["financials"],
      status: "active",
    };
    const flags = getEnabledFeatures(sub);
    expect(flags.has("bankLink")).toBe(true);
    expect(flags.has("nativeInvoicing")).toBe(true);
    expect(flags.has("estimateBuilder")).toBe(false);
    expect(flags.has("projects")).toBe(true);
  });

  it("trialing status still grants access", () => {
    const sub: UserSubscription = {
      tier: "core",
      addons: [],
      status: "trialing",
    };
    expect(getEnabledFeatures(sub).has("projects")).toBe(true);
    expect(getEnabledFeatures(sub).size).toBe(CORE.length);
  });

  it("canceled status blocks all access", () => {
    const sub: UserSubscription = {
      tier: "pro",
      addons: ["financials", "directory"],
      status: "canceled",
    };
    expect(getEnabledFeatures(sub).size).toBe(0);
  });

  it("core + estimating addon matches plus estimating access", () => {
    const coreEst: UserSubscription = {
      tier: "core",
      addons: ["estimating"],
      status: "active",
    };
    const plus: UserSubscription = { tier: "plus", addons: [], status: "active" };
    const a = getEnabledFeatures(coreEst);
    const b = getEnabledFeatures(plus);
    expectSetEqual(a, [...b]);
  });
});

describe("getAllFeatureFlagsSet", () => {
  it("includes every known product flag", () => {
    const all = getAllFeatureFlagsSet();
    expect(all.has("projects")).toBe(true);
    expect(all.has("estimateBuilder")).toBe(true);
    expect(all.has("subBidPortal")).toBe(true);
    expect(all.has("aiTakeoff")).toBe(true);
    expect(all.has("payroll")).toBe(true);
    expect(all.has("documentVault")).toBe(true);
    expect(all.has("messaging")).toBe(true);
    expect(all.size).toBeGreaterThanOrEqual(CORE.length + ESTIMATING.length + PORTALS.length);
  });
});

describe("hasFeature", () => {
  it("returns true only when flag is in enabled set", () => {
    const sub: UserSubscription = { tier: "core", addons: [], status: "active" };
    expect(hasFeature(sub, "projects")).toBe(true);
    expect(hasFeature(sub, "estimateBuilder")).toBe(false);
  });

  it("returns false when subscription is not active/trialing", () => {
    const sub: UserSubscription = { tier: "pro", addons: [], status: "past_due" };
    expect(hasFeature(sub, "projects")).toBe(false);
  });
});
