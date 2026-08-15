import { useState, useCallback, useEffect } from 'react'
import { apiService } from '../../services/api'
import i18n from '../../i18n/config.js'

export interface ProfessionalProfileData {
  preferred_start_time: string
  preferred_end_time: string
}

const sanitizeTime = (value: string | null | undefined, fallback: string): string => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return fallback

  const match = trimmed.match(/^\d{1,2}:\d{2}$/)
  if (!match) return fallback

  return trimmed.slice(0, 5)
}

interface UseProfessionalProfileResult {
  profile: ProfessionalProfileData | null
  loading: boolean
  error: string | null
  refetch: () => void
  saveProfile: (data: ProfessionalProfileData) => Promise<{ success: boolean; error?: string }>
}

const normalizeProfileData = (payload: any): ProfessionalProfileData => {
  const preferredStart =
    payload?.preferred_start_time ??
    payload?.preferredStartTime ??
    payload?.workday_start ??
    payload?.start_time ??
    '09:00'

  const preferredEnd =
    payload?.preferred_end_time ??
    payload?.preferredEndTime ??
    payload?.workday_end ??
    payload?.end_time ??
    '18:00'

  return {
    preferred_start_time: sanitizeTime(preferredStart, '09:00'),
    preferred_end_time: sanitizeTime(preferredEnd, '18:00'),
  }
}

export function useProfessionalProfile(): UseProfessionalProfileResult {
  const [profile, setProfile] = useState<ProfessionalProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.getProfessionalProfile() as any
      setProfile(normalizeProfileData(data?.profile ?? data ?? {}))
    } catch (err: any) {
      setError(err.message || i18n.t('error.loadProfileFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const saveProfile = useCallback(async (data: ProfessionalProfileData): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload = {
        preferred_start_time: sanitizeTime(data.preferred_start_time, '09:00'),
        preferred_end_time: sanitizeTime(data.preferred_end_time, '18:00'),
      }

      await apiService.updateProfessionalProfile(payload)
      setProfile(payload)
      return { success: true }
    } catch (err: any) {
      const errorMessage = err.data?.message || err.message || i18n.t('error.updateProfileFailed')
      return { success: false, error: errorMessage }
    }
  }, [])

  return {
    profile,
    loading,
    error,
    refetch: loadProfile,
    saveProfile,
  }
}
