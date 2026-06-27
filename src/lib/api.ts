// Black Box API client — talks to Cloudflare Pages Functions backend

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  // Safe parse — Cloudflare sometimes returns HTML error pages
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    throw new Error(`Server error (${res.status}): unexpected response format`)
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  // Conversations
  listConversations: () =>
    request<{ conversations: any[] }>('/conversations'),

  getConversation: (id: string) =>
    request<{ conversation: any }>(`/conversations?resource=document&id=${id}`),

  deleteConversation: (id: string) =>
    request<{ ok: boolean }>(`/conversations?id=${id}`, { method: 'DELETE' }),

  // Upload + analyze text
  analyzeText: (payload: { title: string; raw_text: string; participants: string[] }) =>
    request<{ conversation_id: string; status: string }>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ type: 'text', ...payload }),
    }),

  // Upload file (screenshot, pdf, audio)
  uploadFile: async (file: File, type: 'screenshot' | 'pdf' | 'audio') => {
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
    // Safe parse
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error(`Upload error (${res.status}): unexpected server response`)
    }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data as { upload_id: string; url: string; status: string }
  },

  // Analysis status polling — use query param, not path segment
  // Cloudflare Pages Functions don't support dynamic path routing without
  // a dedicated [id].js file — query params work reliably with analyze.js
  getAnalysisStatus: (conversationId: string) =>
    request<{ status: string; analysis?: any }>(`/analyze?id=${conversationId}`),

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

  // Re-analyze existing conversation (versioned)
  reanalyze: (conversationId: string) =>
    request<{ ok: boolean; analysis_id: string; version: number; analysis: any }>('/reanalyze', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId }),
    }),

  // Collections
  listCollections: () =>
    request<{ collections: any[] }>('/collections'),

  getCollection: (id: string) =>
    request<{ collection: any }>(`/collections?id=${id}`),

  createCollection: (name: string, description?: string) =>
    request<{ ok: boolean; id: string }>('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  addToCollection: (collectionId: string, conversationId: string) =>
    request<{ ok: boolean }>('/collections?action=add', {
      method: 'POST',
      body: JSON.stringify({ collection_id: collectionId, conversation_id: conversationId }),
    }),

  removeFromCollection: (collectionId: string, conversationId: string) =>
    request<{ ok: boolean }>('/collections?action=remove', {
      method: 'POST',
      body: JSON.stringify({ collection_id: collectionId, conversation_id: conversationId }),
    }),

  deleteCollection: (id: string) =>
    request<{ ok: boolean }>(`/collections?id=${id}`, { method: 'DELETE' }),
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
    try {
      const result = await api.getAnalysisStatus(conversationId)
      onProgress?.(result.status)
      if (result.status === 'complete') return result.analysis
      if (result.status === 'failed') throw new Error('Analysis failed')
    } catch (err: any) {
      // Don't abort polling on transient errors — log and continue
      console.warn('[BlackBox] Poll attempt failed:', err.message)
      if (i > 5) throw err // Give up after several consecutive failures
    }
  }
  throw new Error('Analysis timed out')
}
