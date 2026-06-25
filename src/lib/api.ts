// Black Box API client — talks to Cloudflare Workers backend

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  // Conversations
  listConversations: () =>
    request<{ conversations: any[] }>('/conversations'),

  getConversation: (id: string) =>
    request<{ conversation: any }>(`/conversations/${id}`),

  deleteConversation: (id: string) =>
    request<{ ok: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),

  // Upload + analyze
  analyzeText: (payload: { title: string; raw_text: string; participants: string[] }) =>
    request<{ conversation_id: string; status: string }>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ type: 'text', ...payload }),
    }),

  uploadFile: async (file: File, type: 'screenshot' | 'pdf' | 'audio') => {
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data as { upload_id: string; url: string; status: string }
  },

  // Analysis status polling
  getAnalysisStatus: (conversationId: string) =>
    request<{ status: string; analysis?: any }>(`/analyze/${conversationId}`),

  // Search
  search: (query: string, filters?: Record<string, string>) =>
    request<{ results: any[] }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, filters }),
    }),

  // Coach
  coach: (draft: string, context?: string) =>
    request<{ report: any }>('/coach', {
      method: 'POST',
      body: JSON.stringify({ draft, context }),
    }),

  // Reports
  generateReport: (conversationIds: string[]) =>
    request<{ report_url: string }>('/report', {
      method: 'POST',
      body: JSON.stringify({ conversation_ids: conversationIds }),
    }),
}

// Poll for analysis completion
export async function pollAnalysis(
  conversationId: string,
  onProgress?: (status: string) => void,
  maxAttempts = 30
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const result = await api.getAnalysisStatus(conversationId)
    onProgress?.(result.status)
    if (result.status === 'complete') return result.analysis
    if (result.status === 'failed') throw new Error('Analysis failed')
  }
  throw new Error('Analysis timed out')
}
