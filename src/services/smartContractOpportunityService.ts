import { supabase } from '@/lib/supabase';

export type OpportunityType = 'offer' | 'request';
export type OpportunityPayoutMode = 'fixed' | 'milestone' | 'hourly' | 'success_fee';
export type OpportunityEngagementType = 'one_off' | 'recurring' | 'milestone';
export type OpportunityStatus = 'open' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
export type OpportunityMatchStatus = 'matched' | 'contract_drafting' | 'contract_sent' | 'closed' | 'cancelled';
export type OpportunityOwnerVerification = 'none' | 'basic' | 'kyc' | 'notarial';

export interface SmartContractOpportunity {
  id: string;
  ownerId: string;
  opportunityType: OpportunityType;
  title: string;
  summary: string;
  serviceCategory: string;
  templateId: string;
  rewardAmount: number | null;
  rewardAsset: string;
  payoutMode: OpportunityPayoutMode;
  engagementType: OpportunityEngagementType;
  location: string | null;
  remoteAllowed: boolean;
  status: OpportunityStatus;
  isPublic: boolean;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerName: string;
  ownerHandle: string;
  ownerAvatarUrl: string | null;
  ownerJobTitle: string | null;
  ownerVerificationLevel: OpportunityOwnerVerification;
  ownerTrustScore: number;
}

export interface SmartContractOpportunityMatch {
  id: string;
  opportunityId: string;
  opportunityStatus: OpportunityStatus;
  contractorId: string;
  contractorName: string;
  contractorHandle: string;
  executorId: string;
  executorName: string;
  executorHandle: string;
  acceptedById: string;
  matchedAt: string;
}

export interface OpportunityFeedFilters {
  limit?: number;
  kind?: OpportunityType | 'all';
  serviceCategory?: string | 'all';
  handle?: string;
  status?: OpportunityStatus | 'all';
  search?: string;
}

export interface CreateSmartContractOpportunityInput {
  ownerId: string;
  opportunityType: OpportunityType;
  title: string;
  summary: string;
  serviceCategory: string;
  templateId: string;
  rewardAmount?: number | null;
  rewardAsset?: string;
  payoutMode?: OpportunityPayoutMode;
  engagementType?: OpportunityEngagementType;
  location?: string | null;
  remoteAllowed?: boolean;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export type OpportunityProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface OpportunityProposal {
  id: string;
  opportunityId: string;
  proposerId: string;
  proposerName: string;
  proposerHandle: string;
  proposerAvatarUrl: string | null;
  proposerJobTitle: string | null;
  proposerVerificationLevel: OpportunityOwnerVerification;
  proposerTrustScore: number;
  amount: number;
  asset: string;
  note: string | null;
  status: OpportunityProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SendProposalInput {
  opportunityId: string;
  proposerId: string;
  proposerName: string;
  proposerHandle: string;
  proposerAvatarUrl?: string | null;
  proposerJobTitle?: string | null;
  proposerVerificationLevel?: OpportunityOwnerVerification;
  proposerTrustScore?: number;
  amount: number;
  asset?: string;
  note?: string | null;
}

export interface AcceptProposalInput {
  opportunityId: string;
  proposalId: string;
  opportunity: SmartContractOpportunity;
  acceptedById: string;
}

const FEATURED_OPPORTUNITIES: SmartContractOpportunity[] = [
  {
    id: 'featured-sucessorio-request',
    ownerId: 'featured-owner-rodrigomartins',
    opportunityType: 'request',
    title: 'Preciso de advogado especialista em direito sucessório — inventário com herdeiro resistente e fazenda sem registro',
    summary: 'Meu pai faleceu em novembro de 2025 sem testamento. Somos três herdeiros: eu, meu irmão mais velho e minha irmã caçula. O problema é que meu irmão mais velho está recusando assinar qualquer documento, travando a abertura do inventário extrajudicial. Temos apartamento em Campinas, cota em fazenda no Triângulo Mineiro (ainda com inventário do meu avô em aberto desde 2018) e um veículo. Preciso de advogado para avaliar extrajudicial vs judicial, tratar da resistência do irmão e destrinchar a pendência da fazenda.',
    serviceCategory: 'Direito Sucessório',
    templateId: 'legal-fees',
    rewardAmount: 4800,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'Campinas, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'honorários por fase',
      heroLabel: 'Inventário complexo — 3 herdeiros',
      socialCaption: 'Pai falecido sem testamento, irmão resistente à assinatura, apartamento + fazenda com inventário do avô em aberto desde 2018. Caso concreto. Preciso de especialista em sucessório.',
      detailPoints: [
        'Consulta inicial e análise do caso: avaliar viabilidade extrajudicial vs judicial dado o bloqueio do herdeiro resistente — 15% na assinatura',
        'Abertura do inventário, citação do irmão e petições para destravamento — 35% após protocolo',
        'Resolução da cota na fazenda (vinculada ao inventário do avô de 2018) e homologação — 30%',
        'Partilha formal, escrituras e registro dos bens em nome dos herdeiros — 20% restantes',
      ],
      urgency: 'ITD vence em 60 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-27T11:40:00.000Z',
    updatedAt: '2026-05-27T11:40:00.000Z',
    ownerName: 'Rodrigo Martins',
    ownerHandle: 'rodrigomartins',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Herdeiro — busca especialista',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 68,
  },
  {
    id: 'featured-thaynogueira-sucessorio-offer',
    ownerId: 'featured-owner-thaynogueira',
    opportunityType: 'offer',
    title: 'Dra. Thay Nogueira — Direito Sucessório completo: inventário, testamento, planejamento e holding familiar',
    summary: 'Advogada especialista em direito sucessório e planejamento patrimonial com 11 anos de OAB/SP. Atendo inventários extrajudiciais e judiciais, elaboração e registro de testamentos, estruturação de doações com reserva de usufruto, holdigs familiares para proteção patrimonial e planejamento sucessório preventivo. Pagamento por fase processual vinculado a smart contract.',
    serviceCategory: 'Direito Sucessório',
    templateId: 'legal-fees',
    rewardAmount: 5500,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'São Paulo, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'honorários por etapa concluída',
      heroLabel: 'Especialista em sucessório e patrimônio',
      socialCaption: 'Dra. Thay Nogueira — 11 anos de OAB/SP em direito sucessório. Inventário, testamento, doação com usufruto e holding familiar. Honorários travados em smart contract, liberação por fase.',
      detailPoints: [
        'Consulta e diagnóstico patrimonial: mapear bens, herdeiros, pendências e risco fiscal — incluso no contrato',
        'Execução do inventário extrajudicial ou judicial, conforme o caso, com todos os atos cartoriais',
        'Elaboração de testamento, doações programadas e estrutura de holding familiar, se aplicável',
        'Planejamento preventivo: redução de ITCMD, proteção contra litígios futuros e organização do acervo',
      ],
      urgency: 'Agenda aberta — 3 vagas este mês',
    },
    expiresAt: null,
    createdAt: '2026-05-27T11:10:00.000Z',
    updatedAt: '2026-05-27T11:10:00.000Z',
    ownerName: 'Dra. Thay Nogueira',
    ownerHandle: 'thaynogueira_sucessorio',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Advogada Sucessória — OAB/SP 287.441',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 96,
  },
  {
    id: 'featured-serralheiro-request',
    ownerId: 'featured-owner-metalprime',
    opportunityType: 'request',
    title: 'Galpão precisa de serralheiro para estrutura metálica por etapas',
    summary: 'Empresa de logística quer contratar execução de estrutura metálica com smart contract liberando bonificação a cada marco aprovado.',
    serviceCategory: 'Serralheria',
    templateId: 'freelancer',
    rewardAmount: 8500,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'milestone',
    location: 'Guarulhos, SP',
    remoteAllowed: false,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'bonificação por etapa validada',
      heroLabel: 'Execução industrial por marcos',
      socialCaption: 'Estrutura metálica de galpão, medição por etapa e liberação automática quando cada frente for aprovada.',
      detailPoints: ['Levantamento e corte inicial', 'Montagem da estrutura', 'Validação técnica com fotos e checklist'],
      urgency: 'Início em 72h',
    },
    expiresAt: null,
    createdAt: '2026-05-26T10:00:00.000Z',
    updatedAt: '2026-05-26T10:00:00.000Z',
    ownerName: 'MetalPrime Engenharia',
    ownerHandle: 'metalprime',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Contratante',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 81,
  },
  {
    id: 'featured-engineering-offer',
    ownerId: 'featured-owner-engenharia',
    opportunityType: 'offer',
    title: 'Engenheiro civil disponível para laudos, ART e acompanhamento de obra',
    summary: 'Profissional oferece disponibilidade com contrato inteligente de aceite e pagamento programado por entrega técnica.',
    serviceCategory: 'Engenharia',
    templateId: 'freelancer',
    rewardAmount: 4200,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Belo Horizonte, MG',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'valor fixo por entrega',
      heroLabel: 'Oferta profissional pronta para contratação',
      socialCaption: 'ART, laudo e acompanhamento técnico com aprovação da entrega e pagamento programado direto no fluxo do contrato.',
      detailPoints: ['Visita técnica e levantamento', 'Entrega do laudo assinado', 'Rodada única de ajustes'],
      urgency: 'Agenda aberta nesta semana',
    },
    expiresAt: null,
    createdAt: '2026-05-26T09:30:00.000Z',
    updatedAt: '2026-05-26T09:30:00.000Z',
    ownerName: 'Carlos Vieira',
    ownerHandle: 'engcarlos',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Prestador disponível',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 93,
  },
  {
    id: 'featured-maintenance-request',
    ownerId: 'featured-owner-fabrica',
    opportunityType: 'request',
    title: 'Indústria busca manutenção elétrica recorrente com smart contract mensal',
    summary: 'Contrato recorrente para inspeção, correção e atendimento emergencial, com gatilho automático de pagamento e SLA documentado.',
    serviceCategory: 'Manutenção Elétrica',
    templateId: 'payroll',
    rewardAmount: 2600,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'recurring',
    location: 'Campinas, SP',
    remoteAllowed: false,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'mensalidade com SLA',
      heroLabel: 'Retainer recorrente com pagamento automático',
      socialCaption: 'Inspeção mensal, plantão e atendimento emergencial com regra clara de SLA e repasse programado.',
      detailPoints: ['Visita mensal programada', 'Chamados emergenciais com janela de atendimento', 'Relatório assinado por ciclo'],
      urgency: 'Contrato recorrente por 12 meses',
    },
    expiresAt: null,
    createdAt: '2026-05-26T08:45:00.000Z',
    updatedAt: '2026-05-26T08:45:00.000Z',
    ownerName: 'Fábrica Horizonte',
    ownerHandle: 'fabrica_horizonte',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Contratante recorrente',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 77,
  },
  {
    id: 'featured-rent-request',
    ownerId: 'featured-owner-casaalto',
    opportunityType: 'request',
    title: 'Proprietária procura operação de aluguel com caução e vistoria digital',
    summary: 'Imóvel alto padrão precisa de gestão contratual com caução tokenizada, vistoria de entrada e devolução programada ao final do ciclo.',
    serviceCategory: 'Locação Imobiliária',
    templateId: 'rent',
    rewardAmount: 3900,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Curitiba, PR',
    remoteAllowed: false,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'fee por operação fechada',
      heroLabel: 'Locação com caução on-chain',
      socialCaption: 'A oportunidade já nasce com escrow da caução, regras de vencimento e vistoria final pronta para execução.',
      detailPoints: ['Definir locatário e vencimento', 'Receber caução em escrow', 'Fechar vistoria e liberar saldo'],
      urgency: 'Imóvel vazio e pronto para locação',
    },
    expiresAt: null,
    createdAt: '2026-05-26T08:20:00.000Z',
    updatedAt: '2026-05-26T08:20:00.000Z',
    ownerName: 'Casa Alto Patrimônio',
    ownerHandle: 'casaalto',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Proprietária',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 79,
  },
  {
    id: 'featured-ecommerce-request',
    ownerId: 'featured-owner-gadgetgo',
    opportunityType: 'request',
    title: 'Loja quer operador de e-commerce com escrow e rastreio integrado',
    summary: 'Operação busca parceiro para tocar vendas online de eletrônicos com confirmação de entrega, disputa e liberação automática do repasse.',
    serviceCategory: 'E-commerce',
    templateId: 'ecommerce',
    rewardAmount: 1800,
    rewardAsset: 'USDC',
    payoutMode: 'success_fee',
    engagementType: 'recurring',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'fee por pedido concluído',
      heroLabel: 'Venda online com garantia de entrega',
      socialCaption: 'Quem assumir essa oportunidade opera pedidos com pagamento protegido até rastreio e confirmação de entrega.',
      detailPoints: ['Registrar cada pedido no fluxo', 'Subir tracking code', 'Acionar disputa ou auto release conforme regra'],
      urgency: 'Volume inicial de 40 pedidos por mês',
    },
    expiresAt: null,
    createdAt: '2026-05-26T08:05:00.000Z',
    updatedAt: '2026-05-26T08:05:00.000Z',
    ownerName: 'GadgetGo Store',
    ownerHandle: 'gadgetgo',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Operação digital',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 74,
  },
  {
    id: 'featured-royalties-offer',
    ownerId: 'featured-owner-estudiolunar',
    opportunityType: 'offer',
    title: 'Produtora oferece catálogo pronto para divisão automática de royalties',
    summary: 'Estúdio independente quer fechar com distribuidoras e coautores usando smart contract para rateio em tempo real de receitas digitais.',
    serviceCategory: 'Música & Conteúdo',
    templateId: 'royalties',
    rewardAmount: 12000,
    rewardAsset: 'USDC',
    payoutMode: 'success_fee',
    engagementType: 'recurring',
    location: 'São Paulo, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'split automático por recebimento',
      heroLabel: 'Royalties divididos sem planilha',
      socialCaption: 'Receita entra uma vez e o contrato já distribui compositores, intérpretes e parceiros sem reconciliação manual.',
      detailPoints: ['Cadastrar beneficiários e percentuais', 'Receber pagamentos recorrentes', 'Atualizar split com aprovação coletiva'],
      urgency: 'Lançamento digital em 10 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-26T07:50:00.000Z',
    updatedAt: '2026-05-26T07:50:00.000Z',
    ownerName: 'Estúdio Lunar',
    ownerHandle: 'estudiolunar',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Produtora',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 88,
  },
  {
    id: 'featured-usucapiao-offer',
    ownerId: 'featured-owner-drsouza',
    opportunityType: 'offer',
    title: 'Advogado imobiliário disponível para conduzir ação de usucapião do início ao trânsito em julgado',
    summary: 'Especialista em direito imobiliário com 9 anos de OAB/SP, apto a analisar posse, reunir documentação, redigir petição inicial e acompanhar todo o rito até a averbação no registro de imóveis. Contrato com liberação por fase.',
    serviceCategory: 'Direito Imobiliário',
    templateId: 'legal-fees',
    rewardAmount: 4800,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'São Paulo, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'honorários por fase processual',
      heroLabel: 'Ação de usucapião completa',
      socialCaption: 'Precisa regularizar imóvel por posse prolongada? Advogado especialista conduz do levantamento documental até a sentença — pagamento liberado fase a fase pelo smart contract.',
      detailPoints: [
        'Análise de viabilidade e levantamento documental da posse (tempo, testemunhas, IPTU, contas)',
        'Redação da petição inicial e ajuizamento — liberação de 35% dos honorários',
        'Acompanhamento de citações, audiências e produção de provas — liberação de 40%',
        'Sentença, registro em cartório e averbação na matrícula — liberação do saldo restante (25%)',
      ],
      urgency: 'Agenda aberta para novos casos',
    },
    expiresAt: null,
    createdAt: '2026-05-27T09:10:00.000Z',
    updatedAt: '2026-05-27T09:10:00.000Z',
    ownerName: 'Dr. Rafael Souza',
    ownerHandle: 'drsouza_imobiliario',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Advogado — OAB/SP 312.847',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 94,
  },
  {
    id: 'featured-defesa-criminal-request',
    ownerId: 'featured-owner-lucasfernandes',
    opportunityType: 'request',
    title: 'Preciso contratar advogado criminalista para minha defesa em processo por furto (art. 155 CP)',
    summary: 'Réu em ação penal pública por furto simples. Processo em fase de instrução, audiência de instrução e julgamento marcada. Preciso de advogado experiente para elaborar defesa técnica, acompanhar AIJ e, se necessário, conduzir apelação.',
    serviceCategory: 'Defesa Criminal',
    templateId: 'legal-fees',
    rewardAmount: 3500,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'Campinas, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'honorários por fase de defesa',
      heroLabel: 'Defesa criminal — art. 155 CP',
      socialCaption: 'Preciso de criminalista para resposta à acusação, AIJ e eventualmente apelação em caso de furto simples. Smart contract libera os honorários fase a fase conforme o andamento.',
      detailPoints: [
        'Consulta inicial, leitura do processo e estratégia de defesa — liberação de 20% na assinatura',
        'Elaboração e protocolo da defesa prévia ou alegações iniciais — liberação de 30%',
        'Audiência de instrução e julgamento (AIJ) com sustentação oral — liberação de 35%',
        'Apelação ou execução de acórdão favorável, se aplicável — liberação do saldo (15%)',
      ],
      urgency: 'AIJ em menos de 60 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-27T08:40:00.000Z',
    updatedAt: '2026-05-27T08:40:00.000Z',
    ownerName: 'Lucas Fernandes',
    ownerHandle: 'lucasfernandes',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Réu — busca defensor',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 61,
  },
  {
    id: 'featured-factoring-offer',
    ownerId: 'featured-owner-metalurgica',
    opportunityType: 'offer',
    title: 'Metalúrgica oferece recebível para antecipação com NF e liquidação rastreável',
    summary: 'PME quer antecipar uma NF grande com investidor institucional, mantendo trilha clara de desconto, vencimento e liquidação do sacado.',
    serviceCategory: 'Factoring',
    templateId: 'factoring',
    rewardAmount: 95000,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Joinville, SC',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'desconto fechado na cessão',
      heroLabel: 'Recebível pronto para funding',
      socialCaption: 'A oportunidade vira cessão estruturada: investidor paga valor descontado, sacado liquida no vencimento e o estado do contrato acompanha tudo.',
      detailPoints: ['Anexar dados da NF', 'Receber funding do investidor', 'Aguardar liquidação do sacado'],
      urgency: 'Vencimento em 45 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-26T07:35:00.000Z',
    updatedAt: '2026-05-26T07:35:00.000Z',
    ownerName: 'Metalúrgica Sul',
    ownerHandle: 'metalurgicasul',
    ownerAvatarUrl: null,
    ownerJobTitle: 'PME emissora',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 82,
  },
  // ─── Marketplace seed: 7 categorias núcleo ──────────────────────────
  {
    id: 'featured-social-media-request',
    ownerId: 'featured-owner-belezaurbana',
    opportunityType: 'request',
    title: 'Loja de cosméticos busca social media com pacote mensal + bônus por seguidores',
    summary: 'Marca DTC de cosméticos precisa terceirizar gestão de Instagram e TikTok com pacote fixo de posts/stories/reels e bônus se bater meta de novos seguidores qualificados.',
    serviceCategory: 'Social Media',
    templateId: 'social_media_management',
    rewardAmount: 2800,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'recurring',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'mensalidade + bônus por meta',
      heroLabel: 'Social media com KPI mensurável',
      socialCaption: 'Pacote mensal de redes sociais com pagamento garantido em escrow e bônus liberado automaticamente quando a meta de seguidores for atingida.',
      detailPoints: [
        '12 posts no feed + 40 stories + 4 reels por mês',
        'Reuniões quinzenais de calendário editorial',
        'Bônus de R$ 500 se +500 seguidores qualificados/mês',
      ],
      urgency: 'Início imediato — campanha de relançamento em 15 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-29T14:10:00.000Z',
    updatedAt: '2026-05-29T14:10:00.000Z',
    ownerName: 'Beleza Urbana Cosméticos',
    ownerHandle: 'belezaurbana',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Marketing / DTC',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 78,
  },
  {
    id: 'featured-design-offer',
    ownerId: 'featured-owner-estudiofolha',
    opportunityType: 'offer',
    title: 'Estúdio de design oferece identidade visual completa com escrow e 2 revisões',
    summary: 'Estúdio criativo disponível para projetos de identidade visual (logo, manual de marca, papelaria e perfis sociais) com pagamento em escrow e cessão total de direitos na entrega final.',
    serviceCategory: 'Design',
    templateId: 'design_creative_brief',
    rewardAmount: 4500,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'São Paulo, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'valor fechado com escrow',
      heroLabel: 'Identidade visual com cessão de direitos',
      socialCaption: 'Briefing → conceito → 2 rodadas de revisão → arquivos finais. Cessão registrada on-chain e pagamento só liberado ao aceite.',
      detailPoints: [
        '30% de kickoff após briefing assinado',
        '2 rodadas de revisão incluídas (extras a R$ 300/cada)',
        'Cessão total e perpétua dos direitos autorais',
      ],
      urgency: 'Agenda com 3 vagas neste mês',
    },
    expiresAt: null,
    createdAt: '2026-05-29T13:45:00.000Z',
    updatedAt: '2026-05-29T13:45:00.000Z',
    ownerName: 'Estúdio Folha',
    ownerHandle: 'estudiofolha',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Estúdio de design',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 91,
  },
  {
    id: 'featured-legal-simple-request',
    ownerId: 'featured-owner-anaclara',
    opportunityType: 'request',
    title: 'Cliente precisa de notificação extrajudicial ao locatário inadimplente',
    summary: 'Proprietária precisa de notificação extrajudicial formal para locatário com 2 meses de aluguel em atraso, com prazo de entrega curto e protocolo via cartório.',
    serviceCategory: 'Serviços Jurídicos',
    templateId: 'legal_simple_service',
    rewardAmount: 950,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Belo Horizonte, MG',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'honorário fixo no aceite',
      heroLabel: 'Entregável jurídico fechado',
      socialCaption: 'Honorário em escrow, advogado redige e protocola, valor é liberado na aprovação do cliente.',
      detailPoints: [
        'Redação da notificação extrajudicial',
        'Envio com AR ou via cartório de títulos e documentos',
        'Comprovante digital com hash registrado',
      ],
      urgency: 'Entrega em até 7 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-29T13:20:00.000Z',
    updatedAt: '2026-05-29T13:20:00.000Z',
    ownerName: 'Ana Clara Mendes',
    ownerHandle: 'anaclaramendes',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Proprietária',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 72,
  },
  {
    id: 'featured-paid-traffic-request',
    ownerId: 'featured-owner-vitafit',
    opportunityType: 'request',
    title: 'E-commerce de suplementos busca gestor de tráfego com fee por performance',
    summary: 'Loja de suplementos com R$ 5k/mês de verba em Meta e Google Ads precisa de gestor com fee fixo + bônus por ROAS acima de 3,5x.',
    serviceCategory: 'Tráfego Pago',
    templateId: 'paid_traffic_kpi',
    rewardAmount: 1500,
    rewardAsset: 'BRZ',
    payoutMode: 'success_fee',
    engagementType: 'recurring',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'fee fixo + bônus por ROAS',
      heroLabel: 'Gestão de mídia com escrow + performance',
      socialCaption: 'Verba e fee depositados no contrato. Gestor recebe o fee mensal automaticamente e ganha bônus extra quando o ROAS combinado é atingido.',
      detailPoints: [
        'R$ 5.000 de verba/mês em Meta Ads + Google Ads',
        'Fee fixo de R$ 1.500/mês de gestão',
        'Bônus de R$ 800 quando ROAS ≥ 3,5x no ciclo',
      ],
      urgency: 'Início em 7 dias — sazonalidade forte em 30d',
    },
    expiresAt: null,
    createdAt: '2026-05-29T12:50:00.000Z',
    updatedAt: '2026-05-29T12:50:00.000Z',
    ownerName: 'VitaFit Suplementos',
    ownerHandle: 'vitafit',
    ownerAvatarUrl: null,
    ownerJobTitle: 'E-commerce',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 80,
  },
  {
    id: 'featured-software-dev-request',
    ownerId: 'featured-owner-acmehealth',
    opportunityType: 'request',
    title: 'Healthtech busca dev sênior fullstack para módulo de telemedicina (4 marcos)',
    summary: 'Healthtech em crescimento precisa de desenvolvedor sênior fullstack (React + Node) para construir módulo de telemedicina com agenda, vídeo e prescrição digital, dividido em 4 marcos com aceite por entrega.',
    serviceCategory: 'Desenvolvimento de Software',
    templateId: 'freelancer',
    rewardAmount: 28000,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'pagamento por marco aprovado',
      heroLabel: 'Squad de produto com pagamento por entrega',
      socialCaption: 'Desenvolvimento dividido em 4 marcos. Cada entrega valida e libera o pagamento — sem risco de calote nem de escopo aberto.',
      detailPoints: [
        'Marco 1: Setup + auth + agenda médica',
        'Marco 2: Sala de vídeo (LiveKit) + chat',
        'Marco 3: Prescrição digital com assinatura',
        'Marco 4: Painel admin + relatórios + handoff',
      ],
      urgency: 'Marco 1 em 21 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-29T12:20:00.000Z',
    updatedAt: '2026-05-29T12:20:00.000Z',
    ownerName: 'Acme Health',
    ownerHandle: 'acmehealth',
    ownerAvatarUrl: null,
    ownerJobTitle: 'CTO / Produto',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 87,
  },
  {
    id: 'featured-bid-financing-offer',
    ownerId: 'featured-owner-constructorabandeirantes',
    opportunityType: 'offer',
    title: 'Construtora oferece empenho de R$ 180k de licitação vencida para antecipação',
    summary: 'PME vencedora de pregão municipal tem empenho emitido (NE 2026/0234) com vencimento em 75 dias e busca investidor para antecipar capital de giro a taxa competitiva.',
    serviceCategory: 'Financiamento de Licitação',
    templateId: 'bid_financing',
    rewardAmount: 180000,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Campinas, SP',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'desconto de 2,4% am · 75d',
      heroLabel: 'Empenho público pronto para funding',
      socialCaption: 'Empenho emitido pela prefeitura, contrato lastreia o fluxo: investidor adianta valor descontado, o pagamento do órgão liquida o investidor automaticamente.',
      detailPoints: [
        'NE 2026/0234 — Pregão Municipal 045/2026',
        'Valor de face R$ 180.000 · prazo 75 dias',
        'Empenho confirmado, obra em fase de atesto',
      ],
      urgency: 'Funding necessário em até 10 dias',
    },
    expiresAt: null,
    createdAt: '2026-05-29T11:55:00.000Z',
    updatedAt: '2026-05-29T11:55:00.000Z',
    ownerName: 'Construtora Bandeirantes',
    ownerHandle: 'constructorabandeirantes',
    ownerAvatarUrl: null,
    ownerJobTitle: 'PME contratada',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 86,
  },
  {
    id: 'featured-private-construction-funding-offer',
    ownerId: 'featured-owner-incorporadoramirante',
    opportunityType: 'offer',
    title: 'Empreiteira oferece NF de obra privada (R$ 250k) com 20% em 45d para antecipação',
    summary: 'Empreiteira com obra residencial em execução precisa antecipar capital sobre NF emitida ao cliente final. Cliente paga 20% em 45d (garantido) e saldo em até 120d.',
    serviceCategory: 'Financiamento de Obra Privada',
    templateId: 'private_construction_funding',
    rewardAmount: 250000,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Florianópolis, SC',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'desconto de 2,8% am · 120d',
      heroLabel: 'Obra privada com gatilho de 20% em 45d',
      socialCaption: 'NF emitida ao cliente final lastreia a antecipação. Contrato libera proporcional ao funder em cada parcela paga e quita no recebimento total.',
      detailPoints: [
        'NF 023456 emitida — valor total R$ 250.000',
        'Gatilho obrigatório de 20% (R$ 50.000) em 45 dias',
        'Quitação total em até 120 dias · garantia: aval dos sócios',
      ],
      urgency: 'Funding em até 15 dias pra cumprir cronograma',
    },
    expiresAt: null,
    createdAt: '2026-05-29T11:25:00.000Z',
    updatedAt: '2026-05-29T11:25:00.000Z',
    ownerName: 'Incorporadora Mirante',
    ownerHandle: 'incorporadoramirante',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Empreiteira / incorporadora',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 89,
  },
  // ─── Vitrine viva: 6 oportunidades recentes (social/design/tráfego) ──
  {
    id: 'featured-social-boutique-request',
    ownerId: 'featured-owner-ateliedahelo',
    opportunityType: 'request',
    title: 'Boutique de moda autoral procura social media com produção visual semanal',
    summary: 'Marca de moda autoral em São Paulo busca social media para gerir Instagram, TikTok e Pinterest, com sessão semanal de fotos no ateliê e produção de reels para lançamento de coleção cápsula.',
    serviceCategory: 'Social Media',
    templateId: 'social_media_management',
    rewardAmount: 3800,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'recurring',
    location: 'São Paulo, SP',
    remoteAllowed: false,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'mensalidade + bônus por engajamento',
      heroLabel: 'Marca de moda autoral · coleção cápsula',
      socialCaption: 'Sessão semanal no ateliê em Pinheiros, 8 reels/mês, 16 posts no feed e calendário editorial integrado com lançamento da nova coleção em julho.',
      detailPoints: [
        '1 dia/semana presencial no ateliê (Pinheiros, SP)',
        '8 reels + 16 posts + 60 stories por mês',
        'Bônus de R$ 600 se reel atingir 100k de views orgânicos',
      ],
      urgency: 'Vaga abre apenas 1 — coleção cápsula em 45 dias',
    },
    expiresAt: null,
    createdAt: '2026-06-01T13:42:00.000Z',
    updatedAt: '2026-06-01T13:42:00.000Z',
    ownerName: 'Ateliê da Helô',
    ownerHandle: 'ateliedahelo',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Moda autoral',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 76,
  },
  {
    id: 'featured-social-fitness-offer',
    ownerId: 'featured-owner-pedrocoach',
    opportunityType: 'offer',
    title: 'Personal trainer 360k seguidores oferece pacote de gestão social media para academias',
    summary: 'Coach fitness com audiência de 360k e bagagem de produção de conteúdo oferece pacote completo de social media para academias e estúdios, incluindo roteirização, gravação e edição de reels semanais.',
    serviceCategory: 'Social Media',
    templateId: 'social_media_management',
    rewardAmount: 4900,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'recurring',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'pacote mensal · cessão de direitos inclusa',
      heroLabel: 'Conteúdo fitness pronto pra performar',
      socialCaption: 'Roteiro, gravação e edição de 12 reels/mês + 4 posts carrossel + gestão da bio e direcionamento de tráfego pago. Cessão de imagem inclusa.',
      detailPoints: [
        '12 reels/mês com formato testado em audiência grande',
        'Acompanhamento de KPIs semanal + relatório mensal',
        '2 reuniões/mês de estratégia editorial',
      ],
      urgency: 'Agenda fecha em 4 dias — 2 slots por mês',
    },
    expiresAt: null,
    createdAt: '2026-06-01T12:15:00.000Z',
    updatedAt: '2026-06-01T12:15:00.000Z',
    ownerName: 'Pedro Coach',
    ownerHandle: 'pedrocoach',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Personal trainer · creator',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 88,
  },
  {
    id: 'featured-design-restaurant-request',
    ownerId: 'featured-owner-bistroaurora',
    opportunityType: 'request',
    title: 'Bistrô novo busca designer para identidade visual + cardápio digital com QR Code',
    summary: 'Bistrô em fase de pré-abertura precisa de designer freelancer para criar identidade visual (logo + paleta + tipografia), placas de mesa e cardápio digital com QR Code responsivo.',
    serviceCategory: 'Design',
    templateId: 'design_creative_brief',
    rewardAmount: 5200,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'Curitiba, PR',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'pagamento por marco · 2 revisões inclusas',
      heroLabel: 'Pré-abertura · identidade fim a fim',
      socialCaption: 'Abrimos em 60 dias. Precisamos de identidade pronta pra impressão de cardápio físico + cardápio digital com QR Code rodando.',
      detailPoints: [
        'Marco 1: Conceito + logo + paleta (10 dias)',
        'Marco 2: Cardápio físico A4 + placas de mesa (15 dias)',
        'Marco 3: Cardápio digital responsivo + QR Code (10 dias)',
      ],
      urgency: 'Pré-abertura em 60 dias — kickoff imediato',
    },
    expiresAt: null,
    createdAt: '2026-06-01T09:30:00.000Z',
    updatedAt: '2026-06-01T09:30:00.000Z',
    ownerName: 'Bistrô Aurora',
    ownerHandle: 'bistroaurora',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Sócio-fundador',
    ownerVerificationLevel: 'basic',
    ownerTrustScore: 74,
  },
  {
    id: 'featured-design-uxui-offer',
    ownerId: 'featured-owner-laracalvi',
    opportunityType: 'offer',
    title: 'Designer sênior UX/UI oferece sprint de redesign para apps mobile (2 semanas)',
    summary: 'Designer UX/UI sênior com portfólio em fintech e healthtech oferece sprint focado de 2 semanas para auditar app, propor redesign e entregar protótipo navegável + design system inicial.',
    serviceCategory: 'Design',
    templateId: 'design_creative_brief',
    rewardAmount: 9800,
    rewardAsset: 'BRZ',
    payoutMode: 'milestone',
    engagementType: 'one_off',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'sprint fechado · 2 semanas',
      heroLabel: 'Redesign de produto em 2 semanas',
      socialCaption: 'Auditoria + redesign + protótipo navegável Figma + design system inicial. Tudo entregue em 10 dias úteis com 2 reuniões síncronas.',
      detailPoints: [
        'Dia 1-3: Auditoria UX, heurísticas e análise de dados',
        'Dia 4-7: Redesign de telas críticas + protótipo',
        'Dia 8-10: Design system + handoff técnico',
      ],
      urgency: 'Próxima janela em 3 semanas — reserve agora',
    },
    expiresAt: null,
    createdAt: '2026-06-01T06:50:00.000Z',
    updatedAt: '2026-06-01T06:50:00.000Z',
    ownerName: 'Lara Calvi',
    ownerHandle: 'laracalvi',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Designer UX/UI sênior',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 94,
  },
  {
    id: 'featured-paid-saas-request',
    ownerId: 'featured-owner-veranosaas',
    opportunityType: 'request',
    title: 'SaaS B2B busca gestor de Google Ads especialista em geração de leads MQL',
    summary: 'SaaS B2B em escala precisa de gestor de Google Ads experiente em ICP de média complexidade para campanhas de search/display com meta de CPL e qualidade de MQL acordada em contrato.',
    serviceCategory: 'Tráfego Pago',
    templateId: 'paid_traffic_kpi',
    rewardAmount: 3500,
    rewardAsset: 'BRZ',
    payoutMode: 'success_fee',
    engagementType: 'recurring',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'fee fixo + bônus por MQL qualificado',
      heroLabel: 'Geração de MQL B2B com KPI claro',
      socialCaption: 'R$ 25k/mês de verba em Google Ads. Fee fixo de R$ 3,5k + R$ 80 por MQL aprovado pelo SDR. Painel ao vivo do CPL.',
      detailPoints: [
        'R$ 25.000/mês de verba em Google Ads (search + Pmax)',
        'Fee fixo R$ 3.500 + R$ 80 por MQL aceito por SDR',
        'Reuniões semanais com time de revops',
      ],
      urgency: 'Mês fiscal começa em 6 dias — kickoff antes',
    },
    expiresAt: null,
    createdAt: '2026-05-31T19:20:00.000Z',
    updatedAt: '2026-05-31T19:20:00.000Z',
    ownerName: 'Verano SaaS',
    ownerHandle: 'veranosaas',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Growth · B2B',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 89,
  },
  {
    id: 'featured-paid-audit-offer',
    ownerId: 'featured-owner-marciomidia',
    opportunityType: 'offer',
    title: 'Especialista em mídia oferece auditoria de campanhas + setup do zero em 7 dias',
    summary: 'Mídia paga sênior com R$ 18M sob gestão oferece pacote fechado de auditoria de campanhas em Meta/Google + reestruturação de conta e setup limpo do zero em até 7 dias úteis.',
    serviceCategory: 'Tráfego Pago',
    templateId: 'paid_traffic_kpi',
    rewardAmount: 2400,
    rewardAsset: 'BRZ',
    payoutMode: 'fixed',
    engagementType: 'one_off',
    location: 'Remoto / Brasil',
    remoteAllowed: true,
    status: 'open',
    isPublic: true,
    metadata: {
      source: 'featured-suggestion',
      bonusLabel: 'pacote fechado · entrega em 7 dias',
      heroLabel: 'Auditoria + reset completo em 1 semana',
      socialCaption: 'Auditoria de 20 pontos críticos, mapa de quick wins, reestruturação da conta e setup limpo do zero. Reunião de handoff inclusa.',
      detailPoints: [
        'Auditoria de 20 pontos (estrutura, criativos, públicos)',
        'Mapa de quick wins com 5 ações prioritárias',
        'Setup limpo: campanhas, eventos, conversões, públicos',
      ],
      urgency: 'Próxima janela: 12 dias úteis',
    },
    expiresAt: null,
    createdAt: '2026-05-30T22:00:00.000Z',
    updatedAt: '2026-05-30T22:00:00.000Z',
    ownerName: 'Márcio Mídia',
    ownerHandle: 'marciomidia',
    ownerAvatarUrl: null,
    ownerJobTitle: 'Mídia paga sênior',
    ownerVerificationLevel: 'kyc',
    ownerTrustScore: 92,
  },
];

function mapOpportunityRow(row: Record<string, any>): SmartContractOpportunity {
  return {
    id: row.id,
    ownerId: row.owner_id,
    opportunityType: row.opportunity_type,
    title: row.title,
    summary: row.summary,
    serviceCategory: row.service_category,
    templateId: row.template_id,
    rewardAmount: row.reward_amount != null ? Number(row.reward_amount) : null,
    rewardAsset: row.reward_asset ?? 'BRZ',
    payoutMode: row.payout_mode ?? 'fixed',
    engagementType: row.engagement_type ?? 'one_off',
    location: row.location ?? null,
    remoteAllowed: Boolean(row.remote_allowed),
    status: row.status ?? 'open',
    isPublic: row.is_public ?? true,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    ownerName: row.owner_name,
    ownerHandle: row.owner_handle,
    ownerAvatarUrl: row.owner_avatar_url ?? null,
    ownerJobTitle: row.owner_job_title ?? null,
    ownerVerificationLevel: row.owner_verification_level ?? 'none',
    ownerTrustScore: Number(row.owner_trust_score ?? 0),
  };
}

function mapOpportunityMatchRow(row: Record<string, any>): SmartContractOpportunityMatch {
  return {
    id: row.match_id,
    opportunityId: row.opportunity_id,
    opportunityStatus: row.opportunity_status ?? 'matched',
    contractorId: row.contractor_id,
    contractorName: row.contractor_name,
    contractorHandle: row.contractor_handle,
    executorId: row.executor_id,
    executorName: row.executor_name,
    executorHandle: row.executor_handle,
    acceptedById: row.accepted_by_id,
    matchedAt: row.matched_at,
  };
}

function applyClientFilters(
  opportunities: SmartContractOpportunity[],
  filters: OpportunityFeedFilters,
) {
  const query = filters.search?.trim().toLowerCase() ?? '';

  return opportunities.filter((opportunity) => {
    const matchesKind = !filters.kind || filters.kind === 'all' || opportunity.opportunityType === filters.kind;
    const matchesStatus = !filters.status || filters.status === 'all' || opportunity.status === filters.status;
    const matchesCategory = !filters.serviceCategory
      || filters.serviceCategory === 'all'
      || opportunity.serviceCategory.toLowerCase() === filters.serviceCategory.toLowerCase();
    const matchesHandle = !filters.handle || opportunity.ownerHandle === filters.handle.replace(/^@/, '').toLowerCase();

    const haystack = [
      opportunity.title,
      opportunity.summary,
      opportunity.serviceCategory,
      opportunity.ownerName,
      opportunity.ownerHandle,
      opportunity.location ?? '',
    ].join(' ').toLowerCase();

    const matchesSearch = !query || haystack.includes(query);
    return matchesKind && matchesStatus && matchesCategory && matchesHandle && matchesSearch;
  });
}

export function formatOpportunityReward(opportunity: Pick<SmartContractOpportunity, 'rewardAmount' | 'rewardAsset' | 'payoutMode'>) {
  if (opportunity.rewardAmount == null) return 'Bonificação a combinar';

  const amount = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(opportunity.rewardAmount);

  const suffix = opportunity.payoutMode === 'hourly'
    ? '/hora'
    : opportunity.payoutMode === 'milestone'
      ? ' por etapa'
      : opportunity.payoutMode === 'success_fee'
        ? ' por sucesso'
        : '';

  return `${amount} ${opportunity.rewardAsset}${suffix}`;
}

export function buildOpportunitySmartContractBrief(
  opportunity: SmartContractOpportunity,
  context?: {
    currentUserName?: string | null;
    currentUserHandle?: string | null;
    match?: SmartContractOpportunityMatch | null;
  },
) {
  const actingGoal = opportunity.opportunityType === 'request'
    ? 'executar a oportunidade publicada no feed e receber a bonificação combinada'
    : 'contratar o profissional ofertante com um smart contract claro e executável';
  const currentUserLabel = context?.currentUserName
    ? `${context.currentUserName}${context.currentUserHandle ? ` (@${context.currentUserHandle})` : ''}`
    : 'o usuário atual';
  const contractorLabel = context?.match
    ? `${context.match.contractorName} (@${context.match.contractorHandle})`
    : opportunity.opportunityType === 'request'
      ? `${opportunity.ownerName} (@${opportunity.ownerHandle})`
      : currentUserLabel;
  const executorLabel = context?.match
    ? `${context.match.executorName} (@${context.match.executorHandle})`
    : opportunity.opportunityType === 'request'
      ? currentUserLabel
      : `${opportunity.ownerName} (@${opportunity.ownerHandle})`;

  return [
    'Contexto importado do feed de oportunidades do marketplace.',
    `Título da oportunidade: ${opportunity.title}.`,
    `Tipo: ${opportunity.opportunityType === 'request' ? 'procura por prestador/execução' : 'oferta de disponibilidade profissional'}.`,
    `Serviço principal: ${opportunity.serviceCategory}.`,
    `Resumo: ${opportunity.summary}.`,
    `Publicada por ${opportunity.ownerName} (@${opportunity.ownerHandle}).`,
    `Contratante esperado: ${contractorLabel}.`,
    `Executor esperado: ${executorLabel}.`,
    `Compensação: ${formatOpportunityReward(opportunity)}.`,
    `Modelo de pagamento: ${opportunity.payoutMode}.`,
    `Formato do trabalho: ${opportunity.engagementType}.`,
    opportunity.location ? `Local: ${opportunity.location}.` : null,
    opportunity.remoteAllowed ? 'Aceita execução remota.' : 'Exige execução presencial.',
    context?.currentUserName ? `Usuário atual no app: ${context.currentUserName}${context.currentUserHandle ? ` (@${context.currentUserHandle})` : ''}.` : null,
    context?.match ? 'O match já foi aceito no feed e agora precisa ser formalizado em um smart contract executável.' : null,
    `Monte este contrato assumindo que o usuário atual quer ${actingGoal}.`,
  ].filter(Boolean).join(' ');
}

export function buildOpportunityVariablePrefill(
  opportunity: SmartContractOpportunity,
  context?: {
    currentUserHandle?: string | null;
    match?: SmartContractOpportunityMatch | null;
  },
): Record<string, string> {
  const prefill: Record<string, string> = {};

  if (opportunity.templateId === 'freelancer') {
    const match = context?.match ?? null;
    const ownerHandle = opportunity.ownerHandle ? `@${opportunity.ownerHandle}` : '';
    const currentUserHandle = context?.currentUserHandle ? `@${context.currentUserHandle}` : '';

    const contractorHandle = match?.contractorHandle
      ? `@${match.contractorHandle}`
      : (opportunity.opportunityType === 'request' ? ownerHandle : currentUserHandle);

    const executorHandle = match?.executorHandle
      ? `@${match.executorHandle}`
      : (opportunity.opportunityType === 'request' ? currentUserHandle : ownerHandle);

    if (contractorHandle) prefill.client = contractorHandle;
    if (executorHandle) prefill.freelancer = executorHandle;
    if (opportunity.summary) prefill.projectScope = opportunity.summary;
    if (opportunity.rewardAmount != null) prefill.totalAmount = String(opportunity.rewardAmount);
    if (opportunity.rewardAsset) prefill.asset = opportunity.rewardAsset;
    if (opportunity.expiresAt) prefill.deadline = opportunity.expiresAt.slice(0, 10);

    if (!prefill.milestoneCount) {
      prefill.milestoneCount = opportunity.payoutMode === 'milestone' ? '4' : '2';
    }
    if (!prefill.reviewDays) prefill.reviewDays = '5';
  }

  return prefill;
}

const FEATURED_DEADLINE_HOURS: Record<string, number> = {
  'featured-serralheiro-request': 72,
  'featured-engineering-offer': 12,
  'featured-rent-request': 240,
  'featured-ecommerce-request': 96,
  'featured-usucapiao-offer': 168,
  'featured-defesa-criminal-request': 96,
  'featured-sucessorio-request': 72,
  'featured-thaynogueira-sucessorio-offer': 144,
};

function decoratedFeaturedOpportunities(): SmartContractOpportunity[] {
  return FEATURED_OPPORTUNITIES
    .map((opportunity) => {
      const hours = FEATURED_DEADLINE_HOURS[opportunity.id];
      if (hours == null) return opportunity;
      return {
        ...opportunity,
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const proposalStore: Map<string, OpportunityProposal[]> = new Map();
let proposalStoreSeeded = false;

function ensureSeededProposals() {
  if (proposalStoreSeeded) return;
  proposalStoreSeeded = true;

  proposalStore.set('featured-serralheiro-request', [
    {
      id: 'prop-seed-001',
      opportunityId: 'featured-serralheiro-request',
      proposerId: 'demo-user-serralheirojoao',
      proposerName: 'João Serralheiros',
      proposerHandle: 'serralheirojoao',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Serralheiro especialista em galpões',
      proposerVerificationLevel: 'basic',
      proposerTrustScore: 86,
      amount: 7800,
      asset: 'BRZ',
      note: 'Posso começar segunda. Equipe de 3 pessoas, entrega em 4 etapas.',
      status: 'pending',
      createdAt: '2026-05-26T09:15:00.000Z',
      updatedAt: '2026-05-26T09:15:00.000Z',
    },
    {
      id: 'prop-seed-002',
      opportunityId: 'featured-serralheiro-request',
      proposerId: 'demo-user-metalrigida',
      proposerName: 'MetalRígida',
      proposerHandle: 'metalrigida',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Empresa de estruturas metálicas',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 91,
      amount: 8200,
      asset: 'BRZ',
      note: 'Inclui projeto executivo, ART e responsável técnico em obra.',
      status: 'pending',
      createdAt: '2026-05-26T09:42:00.000Z',
      updatedAt: '2026-05-26T09:42:00.000Z',
    },
  ]);

  proposalStore.set('featured-engineering-offer', [
    {
      id: 'prop-seed-003',
      opportunityId: 'featured-engineering-offer',
      proposerId: 'demo-user-construtorabr',
      proposerName: 'Construtora BR',
      proposerHandle: 'construtorabr',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Contratante PJ',
      proposerVerificationLevel: 'basic',
      proposerTrustScore: 78,
      amount: 4500,
      asset: 'BRZ',
      note: 'Demanda fixa de 3 laudos/mês, contrato semestral.',
      status: 'pending',
      createdAt: '2026-05-26T08:50:00.000Z',
      updatedAt: '2026-05-26T08:50:00.000Z',
    },
  ]);

  proposalStore.set('featured-rent-request', [
    {
      id: 'prop-seed-004',
      opportunityId: 'featured-rent-request',
      proposerId: 'demo-user-whitehorse',
      proposerName: 'Imobiliária White Horse',
      proposerHandle: 'whitehorse',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Administração de aluguéis',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 89,
      amount: 3700,
      asset: 'BRZ',
      note: 'Vistoria digital + caução em escrow já no nosso fluxo.',
      status: 'pending',
      createdAt: '2026-05-26T08:30:00.000Z',
      updatedAt: '2026-05-26T08:30:00.000Z',
    },
  ]);

  proposalStore.set('featured-usucapiao-offer', [
    {
      id: 'prop-seed-005',
      opportunityId: 'featured-usucapiao-offer',
      proposerId: 'demo-user-marinasoares',
      proposerName: 'Marina Soares',
      proposerHandle: 'marinasoares',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Analista jurídico',
      proposerVerificationLevel: 'basic',
      proposerTrustScore: 72,
      amount: 4800,
      asset: 'BRZ',
      note: 'Possuo a documentação de posse há 22 anos. Casa em nome de terceiro falecido. Preciso da análise o quanto antes.',
      status: 'pending',
      createdAt: '2026-05-27T10:05:00.000Z',
      updatedAt: '2026-05-27T10:05:00.000Z',
    },
    {
      id: 'prop-seed-006',
      opportunityId: 'featured-usucapiao-offer',
      proposerId: 'demo-user-imovelcerto',
      proposerName: 'ImóvelCerto Assessoria',
      proposerHandle: 'imovelcerto',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Assessoria imobiliária',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 85,
      amount: 4800,
      asset: 'BRZ',
      note: 'Cliente com terreno de 180m² no interior de SP, posse ininterrupta há 18 anos. Documentação organizada. Agilidade necessária pois há risco de retomada judicial pelo credor do proprietário original.',
      status: 'pending',
      createdAt: '2026-05-27T11:20:00.000Z',
      updatedAt: '2026-05-27T11:20:00.000Z',
    },
  ]);

  proposalStore.set('featured-defesa-criminal-request', [
    {
      id: 'prop-seed-007',
      opportunityId: 'featured-defesa-criminal-request',
      proposerId: 'demo-user-drcriminal',
      proposerName: 'Dr. André Monteiro',
      proposerHandle: 'drmonteiro_criminal',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Criminalista — OAB/SP 198.553',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 91,
      amount: 3200,
      asset: 'BRZ',
      note: '12 anos de atuação em vara criminal. Já atuei em casos análogos com tese de insuficiência probatória. Consigo entrar no processo hoje. Pagamento por fase como proposto — aceito o modelo no smart contract.',
      status: 'pending',
      createdAt: '2026-05-27T09:50:00.000Z',
      updatedAt: '2026-05-27T09:50:00.000Z',
    },
    {
      id: 'prop-seed-008',
      opportunityId: 'featured-defesa-criminal-request',
      proposerId: 'demo-user-drapaula',
      proposerName: 'Dra. Paula Meirelles',
      proposerHandle: 'drapaula_oab',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Advogada Criminalista — OAB/SP 245.102',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 88,
      amount: 3500,
      asset: 'BRZ',
      note: 'Atendo no fórum de Campinas toda semana. Vou analisar o processo hoje para verificar possibilidade de tese absolutória ou suspensão condicional. Meu valor já inclui eventuais embargos de declaração sem custo adicional.',
      status: 'pending',
      createdAt: '2026-05-27T10:35:00.000Z',
      updatedAt: '2026-05-27T10:35:00.000Z',
    },
  ]);

  proposalStore.set('featured-thaynogueira-sucessorio-offer', [
    {
      id: 'prop-seed-009',
      opportunityId: 'featured-thaynogueira-sucessorio-offer',
      proposerId: 'demo-user-anamariasouza',
      proposerName: 'Ana Maria Souza',
      proposerHandle: 'anamaria_souza',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Empresária',
      proposerVerificationLevel: 'basic',
      proposerTrustScore: 74,
      amount: 5500,
      asset: 'BRZ',
      note: 'Minha mãe faleceu em março. Temos três imóveis e dois filhos como herdeiros. Meu irmão mora no exterior e estamos tentando fazer o inventário extrajudicial. Preciso de alguém que domine o processo e possa orientar sobre o ITCMD do estado de SP.',
      status: 'pending',
      createdAt: '2026-05-27T11:15:00.000Z',
      updatedAt: '2026-05-27T11:15:00.000Z',
    },
    {
      id: 'prop-seed-010',
      opportunityId: 'featured-thaynogueira-sucessorio-offer',
      proposerId: 'demo-user-familiacoelho',
      proposerName: 'Família Coelho',
      proposerHandle: 'familiacoelho',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Clientes pessoa física',
      proposerVerificationLevel: 'none',
      proposerTrustScore: 55,
      amount: 5500,
      asset: 'BRZ',
      note: 'Caso preventivo: pais em vida, patrimônio de cerca de R$ 2,8 milhões entre imóveis e aplicações. Queremos estruturar a sucessão agora para minimizar ITCMD e evitar conflito entre os 4 filhos. Holding familiar é opção que consideramos.',
      status: 'pending',
      createdAt: '2026-05-27T11:48:00.000Z',
      updatedAt: '2026-05-27T11:48:00.000Z',
    },
  ]);

  proposalStore.set('featured-sucessorio-request', [
    {
      id: 'prop-seed-011',
      opportunityId: 'featured-sucessorio-request',
      proposerId: 'demo-user-drcarlossucessorio',
      proposerName: 'Dr. Carlos Henrique',
      proposerHandle: 'drcarlos_sucessorio',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Advogado Sucessório — OAB/MG 143.887',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 89,
      amount: 4500,
      asset: 'BRZ',
      note: 'Tenho experiência justamente com esse tipo de caso: herdeiro resistente + propriedade rural com inventário anterior em aberto. A solução geralmente é abertura de inventário judicial com citação do irmão por hora certa e anexação do processo da fazenda. Posso começar a análise esta semana.',
      status: 'pending',
      createdAt: '2026-05-27T11:55:00.000Z',
      updatedAt: '2026-05-27T11:55:00.000Z',
    },
    {
      id: 'prop-seed-012',
      opportunityId: 'featured-sucessorio-request',
      proposerId: 'demo-user-thaynogueira',
      proposerName: 'Dra. Thay Nogueira',
      proposerHandle: 'thaynogueira_sucessorio',
      proposerAvatarUrl: null,
      proposerJobTitle: 'Advogada Sucessória — OAB/SP 287.441',
      proposerVerificationLevel: 'kyc',
      proposerTrustScore: 96,
      amount: 4800,
      asset: 'BRZ',
      note: 'Já li o resumo do caso. A situação da fazenda é resolvível — o inventário do avô pode ser reaberto em paralelo ou tratado como bem litigioso no inventário do pai, dependendo do que tiver formalmente registrado. Quanto ao irmão resistente, temos ferramentas processuais eficazes. Posso fazer a consulta diagnóstica amanhã.',
      status: 'pending',
      createdAt: '2026-05-27T12:10:00.000Z',
      updatedAt: '2026-05-27T12:10:00.000Z',
    },
  ]);
}

export function getBestProposal(
  opportunity: Pick<SmartContractOpportunity, 'opportunityType'>,
  proposals: OpportunityProposal[],
): OpportunityProposal | null {
  const pending = proposals.filter((proposal) => proposal.status === 'pending');
  if (pending.length === 0) return null;
  const sorted = [...pending].sort((left, right) =>
    opportunity.opportunityType === 'request' ? left.amount - right.amount : right.amount - left.amount,
  );
  return sorted[0];
}

export function countActiveProposals(proposals: OpportunityProposal[]): number {
  return proposals.filter((proposal) => proposal.status === 'pending').length;
}

export function formatProposalAmount(proposal: Pick<OpportunityProposal, 'amount' | 'asset'>) {
  const amount = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(proposal.amount);
  return `${amount} ${proposal.asset}`;
}

export const smartContractOpportunityService = {
  async list(filters: OpportunityFeedFilters = {}): Promise<SmartContractOpportunity[]> {
    const { data, error } = await supabase.rpc('get_smart_contract_opportunity_feed', {
      p_limit: filters.limit ?? 24,
      p_kind: filters.kind && filters.kind !== 'all' ? filters.kind : null,
      p_service_category: filters.serviceCategory && filters.serviceCategory !== 'all' ? filters.serviceCategory : null,
      p_handle: filters.handle ? filters.handle.replace(/^@/, '').toLowerCase() : null,
      p_status: filters.status && filters.status !== 'all' ? filters.status : 'open',
    });

    const source = !error && Array.isArray(data) && data.length > 0
      ? (data as Record<string, any>[]).map(mapOpportunityRow)
      : decoratedFeaturedOpportunities();

    return applyClientFilters(source, filters);
  },

  async create(input: CreateSmartContractOpportunityInput): Promise<string> {
    const payload = {
      owner_id: input.ownerId,
      opportunity_type: input.opportunityType,
      title: input.title.trim(),
      summary: input.summary.trim(),
      service_category: input.serviceCategory.trim(),
      template_id: input.templateId,
      reward_amount: input.rewardAmount ?? null,
      reward_asset: input.rewardAsset ?? 'BRZ',
      payout_mode: input.payoutMode ?? 'fixed',
      engagement_type: input.engagementType ?? 'one_off',
      location: input.location?.trim() || null,
      remote_allowed: input.remoteAllowed ?? true,
      expires_at: input.expiresAt || null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await supabase
      .from('smart_contract_opportunities')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async accept(opportunityId: string): Promise<SmartContractOpportunityMatch> {
    const { data, error } = await supabase.rpc('accept_smart_contract_opportunity', {
      p_opportunity_id: opportunityId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('O servidor não retornou o match da oportunidade aceita.');

    return mapOpportunityMatchRow(row as Record<string, any>);
  },

  async listProposals(opportunityId: string): Promise<OpportunityProposal[]> {
    ensureSeededProposals();
    return [...(proposalStore.get(opportunityId) ?? [])];
  },

  async sendProposal(input: SendProposalInput): Promise<OpportunityProposal> {
    ensureSeededProposals();
    const existing = proposalStore.get(input.opportunityId) ?? [];
    const now = new Date().toISOString();

    const mine = existing.find(
      (proposal) => proposal.proposerId === input.proposerId && proposal.status === 'pending',
    );
    if (mine) {
      mine.amount = input.amount;
      mine.asset = input.asset ?? mine.asset;
      mine.note = input.note ?? null;
      mine.updatedAt = now;
      return { ...mine };
    }

    const proposal: OpportunityProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      opportunityId: input.opportunityId,
      proposerId: input.proposerId,
      proposerName: input.proposerName,
      proposerHandle: input.proposerHandle,
      proposerAvatarUrl: input.proposerAvatarUrl ?? null,
      proposerJobTitle: input.proposerJobTitle ?? null,
      proposerVerificationLevel: input.proposerVerificationLevel ?? 'none',
      proposerTrustScore: input.proposerTrustScore ?? 0,
      amount: input.amount,
      asset: input.asset ?? 'BRZ',
      note: input.note ?? null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    proposalStore.set(input.opportunityId, [proposal, ...existing]);
    return { ...proposal };
  },

  async acceptProposal(input: AcceptProposalInput): Promise<{
    match: SmartContractOpportunityMatch;
    proposal: OpportunityProposal;
  }> {
    ensureSeededProposals();
    const proposals = proposalStore.get(input.opportunityId) ?? [];
    const target = proposals.find((proposal) => proposal.id === input.proposalId);
    if (!target) throw new Error('Proposta não encontrada.');
    if (target.status !== 'pending') throw new Error('Essa proposta não está mais disponível.');

    const now = new Date().toISOString();
    target.status = 'accepted';
    target.updatedAt = now;
    for (const proposal of proposals) {
      if (proposal.id !== input.proposalId && proposal.status === 'pending') {
        proposal.status = 'rejected';
        proposal.updatedAt = now;
      }
    }

    const isRequest = input.opportunity.opportunityType === 'request';
    const match: SmartContractOpportunityMatch = {
      id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      opportunityId: input.opportunityId,
      opportunityStatus: 'matched',
      contractorId: isRequest ? input.opportunity.ownerId : target.proposerId,
      contractorName: isRequest ? input.opportunity.ownerName : target.proposerName,
      contractorHandle: isRequest ? input.opportunity.ownerHandle : target.proposerHandle,
      executorId: isRequest ? target.proposerId : input.opportunity.ownerId,
      executorName: isRequest ? target.proposerName : input.opportunity.ownerName,
      executorHandle: isRequest ? target.proposerHandle : input.opportunity.ownerHandle,
      acceptedById: input.acceptedById,
      matchedAt: now,
    };

    return { match, proposal: { ...target } };
  },

  async withdrawProposal(proposalId: string): Promise<OpportunityProposal | null> {
    ensureSeededProposals();
    for (const list of proposalStore.values()) {
      const found = list.find((proposal) => proposal.id === proposalId);
      if (found) {
        found.status = 'withdrawn';
        found.updatedAt = new Date().toISOString();
        return { ...found };
      }
    }
    return null;
  },
};