/**
 * Formats an Ethereum address by showing only the first 6 and last 4 characters
 * @param address The Ethereum address to format
 * @returns The formatted address string
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Formats a timestamp into a human-readable relative time string
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted relative time string (e.g., '2hr ago', '1w ago')
 */
export const formatRelativeTime = (timestamp: bigint | number): string => {
  const now = Date.now();
  const timeNumber = typeof timestamp === 'bigint' ? Number(timestamp) * 1000 : timestamp * 1000;
  const diff = Math.floor((now - timeNumber) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
};