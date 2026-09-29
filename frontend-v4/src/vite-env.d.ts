/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute base URL of the Deep-Sight backend, no trailing slash.
   * Blank (the default) means same origin  /api and /ws are served by the host that
   * serves the page. See .env.example.
   */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
