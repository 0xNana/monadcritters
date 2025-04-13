export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatWeiToMON = (wei: bigint): string => {
  return (Number(wei.toString()) / 1e18).toFixed(2);
}; 