import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

// Get Plaid environment
function getPlaidEnv(): string {
  const env = process.env.PLAID_ENV || "sandbox";
  switch (env) {
    case "production":
      return PlaidEnvironments.production;
    case "development":
      return PlaidEnvironments.development;
    default:
      return PlaidEnvironments.sandbox;
  }
}

// Create Plaid client configuration
const configuration = new Configuration({
  basePath: getPlaidEnv(),
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

// Export Plaid API client
export const plaidClient = new PlaidApi(configuration);

// Export commonly used types and constants
export { Products, CountryCode };

// Default products to request
export const DEFAULT_PRODUCTS: Products[] = [
  Products.Transactions,
  Products.Auth,
  Products.Identity,
  Products.Investments,
  Products.Liabilities,
];

// Supported country codes
export const SUPPORTED_COUNTRIES: CountryCode[] = [
  CountryCode.Us,
];
