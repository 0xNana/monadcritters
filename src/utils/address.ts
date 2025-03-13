/**
 * Shortens an Ethereum address by showing only the first 6 and last 4 characters
 * @param address The Ethereum address to shorten
 * @returns The shortened address
 */
export function shortenAddress(address: string): string {
  if (!address) return '';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
} 