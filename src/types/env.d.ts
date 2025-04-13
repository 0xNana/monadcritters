/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONAD_CRITTER_ADDRESS: string;
  readonly VITE_CRITTER_CLASH_ADDRESS: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 