export type ContractStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface Contract {
  id: string;
  title: string;
  parties: string[];
  value: number;
  currency: string;
  status: ContractStatus;
  createdAt: string;
  expiresAt: string;
}

export const mockContracts: Contract[] = [
  {
    id: 'CE-9012',
    title: 'Acordo de Fornecimento',
    parties: ['Empresa A', 'Fornecedor B'],
    value: 50000,
    currency: 'USDC',
    status: 'active',
    createdAt: '2026-04-15T10:00:00Z',
    expiresAt: '2026-12-31T23:59:59Z',
  },
  {
    id: 'CE-9013',
    title: 'Prestação de Serviços',
    parties: ['Consultoria X', 'Cliente Y'],
    value: 12000,
    currency: 'BRL',
    status: 'completed',
    createdAt: '2026-03-01T09:30:00Z',
    expiresAt: '2026-05-01T09:30:00Z',
  },
  {
    id: 'CE-9014',
    title: 'Parceria Comercial',
    parties: ['Startup Z', 'Investidor W'],
    value: 250000,
    currency: 'XLM',
    status: 'pending',
    createdAt: '2026-05-04T14:20:00Z',
    expiresAt: '2026-06-04T14:20:00Z',
  }
];

export const getContracts = async (): Promise<Contract[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...mockContracts]);
    }, 800);
  });
};

export const createContract = async (contractData: Omit<Contract, 'id' | 'createdAt' | 'status'>): Promise<Contract> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newContract: Contract = {
        ...contractData,
        id: `CE-${Math.floor(Math.random() * 10000)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      mockContracts.unshift(newContract);
      resolve(newContract);
    }, 1200);
  });
};
