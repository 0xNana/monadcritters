/**
 * IPFS utility functions
 */

// IPFS gateway configuration
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const IPFS_GATEWAYS = [
  PINATA_GATEWAY,
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.ipfs.io/ipfs/'
];

// Current gateway index (for fallback mechanism)
let currentGatewayIndex = 0;

/**
 * Formats an IPFS URI to use a gateway
 * @param uri The IPFS URI to format
 * @returns A URL that can be used to fetch the content
 */
export function formatIpfsUrl(uri: string): string {
  if (!uri) return '';
  
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAYS[currentGatewayIndex]}${uri.replace('ipfs://', '')}`;
  }
  return uri;
}

/**
 * Fetches metadata from an IPFS URI with fallback to other gateways if needed
 * @param uri The IPFS URI or base64 encoded data URI
 * @returns The parsed metadata
 */
export async function fetchMetadata(uri: string): Promise<any> {
  if (!uri) return null;
  
  try {
    // Handle base64 encoded JSON
    if (uri.startsWith('data:application/json;base64,')) {
      const base64Data = uri.split(',')[1];
      const jsonString = atob(base64Data);
      return JSON.parse(jsonString);
    }
    
    // Try with current gateway
    let formattedUri = formatIpfsUrl(uri);
    let response = await fetch(formattedUri);
    
    // If failed, try fallback gateways
    let attempts = 0;
    while (!response.ok && attempts < IPFS_GATEWAYS.length - 1) {
      console.warn(`Gateway ${IPFS_GATEWAYS[currentGatewayIndex]} failed, trying next gateway...`);
      currentGatewayIndex = (currentGatewayIndex + 1) % IPFS_GATEWAYS.length;
      formattedUri = formatIpfsUrl(uri);
      response = await fetch(formattedUri);
      attempts++;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
} 