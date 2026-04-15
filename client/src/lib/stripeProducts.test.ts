import { describe, expect, it } from "@jest/globals";
import { buildLineItems, PRICE_IDS } from "./stripeProducts";

describe("PRICE_IDS", () => {
  it("is populated from test env (jest.setup.cjs)", () => {
    expect(PRICE_IDS.core).toBe("price_core_test");
    expect(PRICE_IDS.fieldPayrollPerEmp).toBe("price_field_payroll_per_emp_test");
  });
});

describe("buildLineItems", () => {
  it("core only: single tier line", () => {
    expect(
      buildLineItems({
        tier: "core",
        addons: [],
        employees: 5,
      }),
    ).toEqual([{ price: "price_core_test", quantity: 1 }]);
  });

  it("plus with portals addon: tier + portals (estimating included in tier)", () => {
    expect(
      buildLineItems({
        tier: "plus",
        addons: ["portals"],
        employees: 5,
      }),
    ).toEqual([
      { price: "price_plus_test", quantity: 1 },
      { price: "price_portals_test", quantity: 1 },
    ]);
  });

  it("pro: estimating and portals in addons do not add separate prices (bundled in tier)", () => {
    expect(
      buildLineItems({
        tier: "pro",
        addons: ["estimating", "portals"],
        employees: 5,
      }),
    ).toEqual([{ price: "price_pro_test", quantity: 1 }]);
  });

  it("fieldpayroll with 8 employees: base + 3 per-employee overage seats", () => {
    expect(
      buildLineItems({
        tier: "core",
        addons: ["fieldpayroll"],
        employees: 8,
      }),
    ).toEqual([
      { price: "price_core_test", quantity: 1 },
      { price: "price_field_payroll_base_test", quantity: 1 },
      { price: "price_field_payroll_per_emp_test", quantity: 3 },
    ]);
  });

  it("fieldpayroll with 5 employees: no per-employee line", () => {
    expect(
      buildLineItems({
        tier: "core",
        addons: ["fieldpayroll"],
        employees: 5,
      }),
    ).toEqual([
      { price: "price_core_test", quantity: 1 },
      { price: "price_field_payroll_base_test", quantity: 1 },
    ]);
  });
});
