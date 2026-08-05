/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_STELLAR_NETWORK?: 'testnet' | 'mainnet';
  /** '1' entra em modo demonstração, sem back-end. Só para builds locais. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// React 19 removed the global JSX namespace, so custom elements must be
// registered via module augmentation on 'react' instead of `declare global`.
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        icon?: string;
        class?: string;
        width?: string | number;
        height?: string | number;
      };
    }
  }
}
