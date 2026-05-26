/**
 * Soroban Init Args Mapper
 *
 * Converte os `variables` (Record<string, string>) que o usuário preenche
 * no SmartContractEditor → array de `ScValPayload` consumido pela Edge
 * Function `deploy-soroban`.
 *
 * Cada template tem seu próprio shape de `init`. Esse arquivo isola toda
 * a tradução, mantendo o resto do código limpo.
 *
 * IDs suportados:
 *   - rent
 *   - ecommerce
 *   - freelancer
 *   - legal_fees
 *   - construction_contract
 *   - real_estate_token
 */

import { sc, type ScValPayload } from './sorobanDeploy';

const STROOP = 10_000_000n; // 1 unidade = 1e7 stroops (7 decimais Stellar)

/**
 * Endereços oficiais (TODO: confirmar com Transfero antes de mainnet).
 * Em produção, isso virá de uma tabela no DB.
 */
export const BRZ_TOKEN_ADDRESS: Record<'testnet' | 'mainnet', string> = {
  testnet: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  mainnet: 'CAVXSXVMXOJUL7GBJVUO52CFEY6V7CDQUUWHV4VEHKCV4QGI6FYFKL66',
};

/** Resolve o asset (BRZ/USDC) para Address Soroban. */
function assetAddress(symbol: string, network: 'testnet' | 'mainnet'): string {
  switch (symbol.toUpperCase()) {
    case 'BRZ':
      return BRZ_TOKEN_ADDRESS[network];
    case 'USDC':
      // USDC oficial Circle na Stellar
      return network === 'mainnet'
        ? 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'
        : 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
    case 'XLM':
      return network === 'mainnet'
        ? 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
        : 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    default:
      throw new Error(`Asset não suportado: ${symbol}`);
  }
}

/** Converte número decimal "2500" → bigint em stroops "25000000000". */
function toStroops(value: string): bigint {
  if (!value) return 0n;
  // Aceita "2500", "2.500,50", "2500.50"
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const [int, dec = ''] = cleaned.split('.');
  const intBig = BigInt(int || '0');
  const decPadded = (dec + '0000000').slice(0, 7); // padding para 7 decimais
  return intBig * STROOP + BigInt(decPadded);
}

/** Hash placeholder 32-bytes para campos de hash (matrícula, produto, etc). */
function placeholderHash32(): string {
  // Em produção, gerar SHA-256 do conteúdo descrito (endereço, foto, etc).
  return '0'.repeat(64);
}

/** Resolve uma data ISO (YYYY-MM-DD) → days from now (u32). Reservado para templates futuros. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _daysFromNow(isoDate: string | undefined, fallback = 90): number {
  if (!isoDate) return fallback;
  const target = new Date(isoDate).getTime();
  const now = Date.now();
  const days = Math.ceil((target - now) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

// ─────────────────────────────────────────────────────────────────────

export const SOROBAN_SUPPORTED_TEMPLATES = [
  'rent',
  'ecommerce',
  'freelancer',
  'legal_fees',
  'construction_contract',
  'real_estate_token',
] as const;

export type SupportedTemplateId = (typeof SOROBAN_SUPPORTED_TEMPLATES)[number];

export function isSorobanSupported(templateId: string): templateId is SupportedTemplateId {
  return SOROBAN_SUPPORTED_TEMPLATES.includes(templateId as SupportedTemplateId);
}

// ─────────────────────────────────────────────────────────────────────
// MAPPERS POR TEMPLATE
// ─────────────────────────────────────────────────────────────────────

interface BuildArgs {
  vars: Record<string, string>;
  network: 'testnet' | 'mainnet';
}

function buildRentInitArgs({ vars, network }: BuildArgs): ScValPayload[] {
  return [
    sc.struct({
      landlord: sc.addr(vars.landlord),
      tenant: sc.addr(vars.tenant),
      asset: sc.addr(assetAddress(vars.asset || 'BRZ', network)),
      monthly_rent: sc.i128(toStroops(vars.monthlyRent || '0').toString()),
      deposit_months: sc.u32(Number(vars.depositMonths || '3')),
      due_day: sc.u32(Number(vars.dueDay || '5')),
      duration_months: sc.u32(Number(vars.durationMonths || '30')),
      late_fee_bps: sc.u32(200), // 2% padrão
      max_consecutive_overdue: sc.u32(3),
      property_hash: sc.bytes(placeholderHash32()),
    }),
  ];
}

function buildEcommerceInitArgs({ vars, network }: BuildArgs): ScValPayload[] {
  return [
    sc.struct({
      buyer: sc.addr(vars.buyer),
      seller: sc.addr(vars.seller),
      arbiter: sc.opt(null), // sem árbitro por padrão
      asset: sc.addr(assetAddress(vars.asset || 'BRZ', network)),
      amount: sc.i128(toStroops(vars.amount || '0').toString()),
      auto_release_days: sc.u32(Number(vars.autoReleaseDays || '7')),
      dispute_resolution_days: sc.u32(15),
      product_hash: sc.bytes(placeholderHash32()),
    }),
  ];
}

function buildFreelancerInitArgs({ vars, network }: BuildArgs): ScValPayload[] {
  const count = Number(vars.milestoneCount || '4');
  const totalStroops = toStroops(vars.totalAmount || '0');
  const perMilestone = totalStroops / BigInt(count);

  const amounts: ScValPayload[] = [];
  for (let i = 0; i < count; i++) {
    amounts.push(sc.i128(perMilestone.toString()));
  }

  return [
    sc.struct({
      client: sc.addr(vars.client),
      freelancer: sc.addr(vars.freelancer),
      asset: sc.addr(assetAddress(vars.asset || 'USDC', network)),
      milestone_amounts: sc.vec(amounts),
      review_days: sc.u32(Number(vars.reviewDays || '5')),
      stale_after_days: sc.u32(30),
    }),
  ];
}

function buildLegalFeesInitArgs({ vars, network }: BuildArgs): ScValPayload[] {
  return [
    sc.struct({
      lawyer: sc.addr(vars.lawyer),
      client: sc.addr(vars.client),
      asset: sc.addr(assetAddress(vars.asset || 'BRZ', network)),
      retainer: sc.i128(toStroops(vars.retainerAmount || '0').toString()),
      monthly_fee: sc.i128(toStroops(vars.monthlyFee || '0').toString()),
      duration_months: sc.u32(Number(vars.durationMonths || '12')),
      success_rate_bps: sc.u32(Number(vars.successRate || '20') * 100),
      termination_fee_bps: sc.u32(1000), // 10%
      case_id_hash: sc.bytes(placeholderHash32()),
    }),
  ];
}

function buildConstructionInitArgs({ vars, network }: BuildArgs): ScValPayload[] {
  const count = Number(vars.milestonesCount || '5');
  const totalStroops = toStroops(vars.totalValue || '0');
  const perMilestone = totalStroops / BigInt(count);

  const amounts: ScValPayload[] = [];
  for (let i = 0; i < count; i++) {
    amounts.push(sc.i128(perMilestone.toString()));
  }

  return [
    sc.struct({
      contractor: sc.addr(vars.contractor),
      client: sc.addr(vars.client),
      engineer: sc.addr(vars.engineer),
      arbiter: sc.opt(null),
      asset: sc.addr(assetAddress(vars.asset || 'BRZ', network)),
      milestone_amounts: sc.vec(amounts),
      retention_bps: sc.u32(Number(vars.retentionPct || '5') * 100),
      warranty_days: sc.u32(90),
      work_address_hash: sc.bytes(placeholderHash32()),
    }),
  ];
}

function buildRealEstateInitArgs({ vars, network }: BuildArgs): ScValPayload[] {
  // O share_token precisa ser deployado ANTES — esse fluxo só inicializa o vault.
  // O endereço do share_token deve vir como input opcional.
  return [
    sc.struct({
      sponsor: sc.addr(vars.sponsor),
      share_token: sc.addr(vars.shareTokenAddress || vars.sponsor), // placeholder
      payout_asset: sc.addr(assetAddress(vars.asset || 'BRZ', network)),
      total_shares: sc.u32(Number(vars.totalShares || '1000')),
      share_price: sc.i128(toStroops(vars.sharePrice || '0').toString()),
      min_shares_quorum_bps: sc.u32(5000), // 50%
      matricula_hash: sc.bytes(placeholderHash32()),
      fundraising_days: sc.u32(60),
    }),
  ];
}

// ─────────────────────────────────────────────────────────────────────
// DISPATCH
// ─────────────────────────────────────────────────────────────────────

export function buildInitArgs(
  templateId: string,
  vars: Record<string, string>,
  network: 'testnet' | 'mainnet' = 'testnet',
): ScValPayload[] {
  if (!isSorobanSupported(templateId)) {
    throw new Error(`Template "${templateId}" não tem implementação Soroban disponível.`);
  }
  const args: BuildArgs = { vars, network };
  switch (templateId) {
    case 'rent':
      return buildRentInitArgs(args);
    case 'ecommerce':
      return buildEcommerceInitArgs(args);
    case 'freelancer':
      return buildFreelancerInitArgs(args);
    case 'legal_fees':
      return buildLegalFeesInitArgs(args);
    case 'construction_contract':
      return buildConstructionInitArgs(args);
    case 'real_estate_token':
      return buildRealEstateInitArgs(args);
  }
}
