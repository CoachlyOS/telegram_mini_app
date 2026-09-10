import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../../services/api'
import i18n from '../../../i18n/config.js'

// Multilingual text is stored in the DB as a {<lang>: <text>} JSONB map keyed by
// locale code. The backend does not know the requester's locale, so it returns
// the whole map and the frontend picks the entry for the current language.
export type LocalizedText = Record<string, string>

export interface ProfessionalDiscipline {
  id: string
  slug: string
  name: LocalizedText
}

export interface ProfessionalSocials {
  telegram?: string
  whatsapp?: string
  instagram?: string
  [key: string]: string | undefined
}

export interface GetProfessionalsResponseItem {
  id: string
  first_name: string
  last_name: string
  chat_id?: number | null
  locale: string
  biography?: LocalizedText | null
  socials?: ProfessionalSocials | null
  disciplines?: ProfessionalDiscipline[]
}

// pickLocalized returns the text for the current i18n language, falling back to
// 'en', then to the first available key, then to ''. The DB seeds disciplines
// with only {uk,pl,ru} (no 'en') and biography with {en,pl,ru} (no 'uk'), so the
// fallback chain must tolerate missing keys gracefully.
export function pickLocalized(value: LocalizedText | null | undefined): string {
  if (!value) return ''
  const lang = i18n.language?.split('-')[0]
  if (lang && value[lang]) return value[lang]
  if (value.en) return value.en
  const keys = Object.keys(value)
  return keys.length ? value[keys[0]] : ''
}

export interface PaginationResponse {
  has_next_page: boolean
  page: number
  page_size: number
}

export interface GetProfessionalsResponse {
  professionals: GetProfessionalsResponseItem[]
  pagination: PaginationResponse
}

interface UseProfessionalsResult {
  professionals: GetProfessionalsResponseItem[]
  loading: boolean
  error: string | null
  pagination: PaginationResponse | null
  page: number
  setPage: (page: number) => void
  refetch: () => void
}

export function useProfessionals(pageSize: number = 15, enabled: boolean = true): UseProfessionalsResult {
  const [professionals, setProfessionals] = useState<GetProfessionalsResponseItem[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProfessionals = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.getProfessionals(page, pageSize) as GetProfessionalsResponse
      setProfessionals(data.professionals || [])
      setPagination(data.pagination)
    } catch (err) {
      setError(i18n.t('error.loadProfessionalsFailed'))
      setProfessionals([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, enabled])

  useEffect(() => {
    if (enabled) {
      loadProfessionals()
    }
  }, [loadProfessionals, enabled])

  return {
    professionals,
    loading,
    error,
    pagination,
    page,
    setPage,
    refetch: loadProfessionals,
  }
}
