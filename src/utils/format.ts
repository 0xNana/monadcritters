/**
 * Formats an Ethereum address by showing only the first 6 and last 4 characters
 * @param address The Ethereum address to format
 * @returns The formatted address string
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}; 