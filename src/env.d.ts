/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRITTER_CLASH_STATS_ADDRESS: string;
  readonly VITE_CRITTER_CLASH_CORE_ADDRESS: string;
  readonly VITE_MONAD_CRITTER_ADDRESS: string;
  readonly VITE_MONAD_TESTNET_URL: string;
  readonly VITE_MONAD_PRIMARY_RPC: string;
  readonly VITE_MONAD_ALCHEMY_RPC1: string;
  readonly VITE_MONAD_ALCHEMY_RPC2: string;
  readonly VITE_MONAD_BACKUP_RPC: string;
  readonly VITE_REOWN_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 