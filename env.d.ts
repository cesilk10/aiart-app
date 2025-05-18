interface ImportMetaEnv {
  readonly VITE_AWS_ACCESS_KEY_ID: string
  readonly VITE_AWS_SECRET_ACCESS_KEY: string
  readonly VITE_AWS_REGION: string
  readonly VITE_AWS_BUCKET: string
  readonly VITE_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}