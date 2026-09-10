import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../services/api'
import i18n from '../../i18n/config.js'

// A client as returned by GET /professionals/clients (the system-wide client list
// that replaced the old subscription roster). chat_id is null/omitted for clients
// without a linked Telegram account.
export interface Client {
  id: string
  first_name: string
  last_name: string
  chat_id: number | null
  locale: string
}

interface GetClientsResponse {
  clients: Client[]
}

interface UseClientsResult {
  clients: Client[]
  loading: boolean
  error: string | null
  refetch: () => void
  // In-memory filter over the loaded list by first/last name (case-insensitive).
  // Empty query returns the full list. Convenience for search inputs.
  searchClients: (query: string) => Client[]
}

// Loads the full client list once on mount and keeps it in state. The backend no
// longer paginates or scopes this list (subscriptions were removed), so a single
// fetch is enough; consumers filter in-memory via searchClients().
export function useClients(): UseClientsResult {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getClients() as GetClientsResponse
      setClients(response.clients || [])
    } catch (err: any) {
      setError(err.message || i18n.t('error.loadClientsFailed'))
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const searchClients = useCallback((query: string): Client[] => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const full = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase()
      return full.includes(q)
    })
  }, [clients])

  return {
    clients,
    loading,
    error,
    refetch: fetchClients,
    searchClients,
  }
}
