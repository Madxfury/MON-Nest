// Capability discovery only. Never creates an execution, quote, or deposit address.
export const AURORA_CAPABILITIES_URL = 'https://intents-connect-alpha-api.aurora.dev/api/v1/supported_tokens';
export type AuroraAvailability = {
  status: 'missing-route' | 'verification-required';
  checkedAt: string;
  sourceChainId: 1313161555;
  destinationChainId: 10143;
  sourceAdvertised: boolean;
  destinationAdvertised: boolean;
  advertisedMonadChainIds: number[];
  advertisedMonadSymbols: string[];
  fundingEnabled: false;
};

type Token = { assetId: string; blockchain: string; symbol: string; contractAddress: string };
function tokens(value: unknown): Token[] {
  if (!Array.isArray(value) || value.length > 5000 || value.some(token => !token ||
    ['assetId', 'blockchain', 'symbol', 'contractAddress'].some(key => typeof token[key] !== 'string'))) {
    throw new Error('Invalid Aurora capability response');
  }
  return value;
}

// HOT's advertised EVM asset identifier includes the actual chain ID. A display
// name such as "monad" alone must never authorize a testnet destination.
function chainId(token: Token): number | undefined {
  const match = /^nep245:[^:]+:(\d+)_/.exec(token.assetId);
  if (!match) return undefined;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : undefined;
}

export function inspectAuroraCapabilities(data: unknown, checkedAt = new Date().toISOString()): AuroraAvailability {
  if (!data || typeof data !== 'object' || !('result' in data) || !data.result || typeof data.result !== 'object') {
    throw new Error('Invalid Aurora capability response');
  }
  const result = data.result as { in?: unknown; out?: unknown };
  const inputs = tokens(result.in), outputs = tokens(result.out);
  const monad = outputs.filter(token => /^monad(?:[-_ ]testnet)?$/i.test(token.blockchain));
  const sourceAdvertised = inputs.some(token => chainId(token) === 1313161555 && /^aurora(?:[-_ ]testnet)?$/i.test(token.blockchain));
  const destinationAdvertised = monad.some(token => chainId(token) === 10143 && token.symbol === 'MON' && token.contractAddress === '');
  return {
    status: sourceAdvertised && destinationAdvertised ? 'verification-required' : 'missing-route',
    checkedAt, sourceChainId: 1313161555, destinationChainId: 10143,
    sourceAdvertised, destinationAdvertised,
    advertisedMonadChainIds: [...new Set(monad.map(chainId).filter((id): id is number => id !== undefined))].sort((a, b) => a - b),
    advertisedMonadSymbols: [...new Set(monad.map(token => token.symbol).filter(symbol => /^[A-Za-z0-9.-]{1,16}$/.test(symbol)))].sort(),
    // An advertised token is not proof of a viable escrow execution. A separately
    // reviewed quote/sign/deposit/receipt flow is required before enabling funds.
    fundingEnabled: false,
  };
}

export async function fetchAuroraAvailability(fetcher: typeof fetch = fetch): Promise<AuroraAvailability> {
  const response = await fetcher(AURORA_CAPABILITIES_URL, { signal: AbortSignal.timeout(12_000), cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error('Aurora capability service unavailable');
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Aurora capability response too large');
  return inspectAuroraCapabilities(JSON.parse(body));
}
