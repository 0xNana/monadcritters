/**
 * Utility functions for fetching data
 */

// Cache for metadata to avoid redundant fetches
const metadataCache: Record<string, any> = {};

/**
 * Fetches JSON data from a URL with caching
 * @param url The URL to fetch from
 * @param skipCache Whether to skip the cache and force a fresh fetch
 * @returns The parsed JSON data
 */
export async function fetchJson<T>(url: string, skipCache = false): Promise<T> {
  // Check cache first
  if (!skipCache && metadataCache[url]) {
    return metadataCache[url] as T;
  }
  
  // Handle IPFS URLs
  const fetchUrl = url.startsWith('ipfs://')
    ? `https://ipfs.io/ipfs/${url.replace('ipfs://', '')}`
    : url;
  
  const response = await fetch(fetchUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Cache the result
  metadataCache[url] = data;
  
  return data as T;
}

/**
 * Clears the metadata cache
 * @param url Optional specific URL to clear from cache
 */
export function clearMetadataCache(url?: string): void {
  if (url) {
    delete metadataCache[url];
  } else {
    Object.keys(metadataCache).forEach(key => {
      delete metadataCache[key];
    });
  }
} 