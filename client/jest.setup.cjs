/* Runs before each test file (before module imports). See Jest `setupFiles`. */
process.env.VITE_STRIPE_PRICE_CORE = "price_core_test";
process.env.VITE_STRIPE_PRICE_PLUS = "price_plus_test";
process.env.VITE_STRIPE_PRICE_PRO = "price_pro_test";
process.env.VITE_STRIPE_PRICE_ESTIMATING = "price_estimating_test";
process.env.VITE_STRIPE_PRICE_PORTALS = "price_portals_test";
process.env.VITE_STRIPE_PRICE_AI_TAKEOFF = "price_ai_takeoff_test";
process.env.VITE_STRIPE_PRICE_FINANCIALS = "price_financials_test";
process.env.VITE_STRIPE_PRICE_FIELD_PAYROLL_BASE = "price_field_payroll_base_test";
process.env.VITE_STRIPE_PRICE_FIELD_PAYROLL_PER_EMP = "price_field_payroll_per_emp_test";
process.env.VITE_STRIPE_PRICE_DOCS = "price_docs_test";
process.env.VITE_STRIPE_PRICE_DIRECTORY = "price_directory_test";
