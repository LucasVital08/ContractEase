// Simulação de um Client HTTP (Axios/Fetch Wrapper)
// Na Fase 2 implementamos o interceptor que injeta o JWT token em todas as requests.

export const httpClient = {
  get: async (url: string) => {
    return mockFetch(url, 'GET');
  },
  post: async (url: string, data?: any) => {
    return mockFetch(url, 'POST', data);
  },
  put: async (url: string, data?: any) => {
    return mockFetch(url, 'PUT', data);
  },
  delete: async (url: string) => {
    return mockFetch(url, 'DELETE');
  }
};

async function mockFetch(url: string, method: string, data?: any) {
  // INTERCEPTOR (MOCK)
  const token = localStorage.getItem('@ContractEase:token');
  
  if (!token && !url.includes('/auth/')) {
    // Simulando 401 Unauthorized
    throw new Error('Não autorizado (401)');
  }

  // Se fosse fetch real seria algo como:
  // return fetch(url, { method, headers: { Authorization: `Bearer ${token}` } })

  console.log(`[HTTP ${method}] ${url} - Token: ${token ? 'Presente' : 'Ausente'}`);

  return { success: true, data };
}
