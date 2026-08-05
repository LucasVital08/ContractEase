/**
 * Contrato comum entre todas as carteiras suportadas.
 *
 * A UI nunca fala com MetaMask/Freighter direto — ela fala com um
 * `WalletProvider`. Assim, adicionar uma carteira nova não muda nenhuma tela.
 */

export type WalletProviderId = 'metamask' | 'freighter' | 'app';

export type StellarNetwork = 'testnet' | 'mainnet';

export interface WalletAccount {
  /** Endereço público Stellar (começa com G...) */
  address: string;
  network: StellarNetwork;
}

export interface WalletAvailability {
  /** A carteira existe neste navegador? */
  installed: boolean;
  /** O que fazer quando não existe (link de instalação). */
  installUrl?: string;
  /** Motivo legível quando não dá pra usar. */
  reason?: string;
}

export interface WalletProviderMeta {
  id: WalletProviderId;
  /** Nome que o usuário lê. */
  name: string;
  /** Uma linha explicando o que é, sem jargão. */
  tagline: string;
  icon: string;
  installUrl: string;
  /** Passos que o usuário precisa fazer, em português simples. */
  steps: string[];
  /** Aviso honesto sobre limitações. */
  caveat?: string;
  recommended?: boolean;
}

export interface WalletProvider {
  meta: WalletProviderMeta;
  /** Checa presença sem abrir nenhum popup. */
  detect: () => Promise<WalletAvailability>;
  /** Lê a conta já autorizada. `null` se ainda não conectou. */
  getAccount: (network: StellarNetwork) => Promise<WalletAccount | null>;
  /** Pede conexão — pode abrir popup. */
  connect: (network: StellarNetwork) => Promise<WalletAccount>;
  /** Assina um XDR e devolve o XDR assinado. */
  signXdr: (xdr: string, network: StellarNetwork) => Promise<string>;
  /** Esquece a conexão no lado do app. */
  disconnect?: () => Promise<void>;
}

export class WalletError extends Error {
  /** Instrução acionável — o que o usuário faz agora pra destravar. */
  readonly fix?: string;
  readonly providerId: WalletProviderId;

  constructor(providerId: WalletProviderId, message: string, fix?: string) {
    super(message);
    this.name = 'WalletError';
    this.providerId = providerId;
    this.fix = fix;
  }
}
