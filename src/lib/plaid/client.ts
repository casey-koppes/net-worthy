import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

// Get Plaid environment
function getPlaidEnv(): string {
  const env = (process.env.PLAID_ENV || "sandbox").trim();
  switch (env) {
    case "production":
      return PlaidEnvironments.production;
    case "development":
      return PlaidEnvironments.development;
    default:
      return PlaidEnvironments.sandbox;
  }
}

// Lazy initialization of Plaid client to ensure env vars are available
let _plaidClient: PlaidApi | null = null;

function getPlaidClient(): PlaidApi {
  if (!_plaidClient) {
    // Trim env vars to remove any trailing whitespace/newlines
    const clientId = (process.env.PLAID_CLIENT_ID || "").trim();
    const secret = (process.env.PLAID_SECRET || "").trim();

    const configuration = new Configuration({
      basePath: getPlaidEnv(),
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    });
    _plaidClient = new PlaidApi(configuration);
  }
  return _plaidClient;
}

// Export Plaid API client (lazy-loaded)
export const plaidClient = {
  linkTokenCreate: (...args: Parameters<PlaidApi["linkTokenCreate"]>) =>
    getPlaidClient().linkTokenCreate(...args),
  itemPublicTokenExchange: (...args: Parameters<PlaidApi["itemPublicTokenExchange"]>) =>
    getPlaidClient().itemPublicTokenExchange(...args),
  itemGet: (...args: Parameters<PlaidApi["itemGet"]>) =>
    getPlaidClient().itemGet(...args),
  accountsGet: (...args: Parameters<PlaidApi["accountsGet"]>) =>
    getPlaidClient().accountsGet(...args),
  institutionsGetById: (...args: Parameters<PlaidApi["institutionsGetById"]>) =>
    getPlaidClient().institutionsGetById(...args),
  transactionsSync: (...args: Parameters<PlaidApi["transactionsSync"]>) =>
    getPlaidClient().transactionsSync(...args),
};

// Export commonly used types and constants
export { Products, CountryCode };

// Default products to request (using standard sandbox-compatible products)
export const DEFAULT_PRODUCTS: Products[] = [
  Products.Transactions,
];

// Supported country codes
export const SUPPORTED_COUNTRIES: CountryCode[] = [
  CountryCode.Us,
];
