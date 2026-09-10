import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../../services/api'
import i18n from '../../../i18n/config.js'
import {
  type LocalizedText,
  type ProfessionalDiscipline,
  type ProfessionalSocials,
} from '../../_signedin_client.professionals/hooks/useProfessionals'

// The coach's own profile, as returned by GET /professionals/profile. biography
// and socials arrive as the empty object `{}` for a fresh coach (the JSONB columns
// default to '{}'::jsonb), not null — so seed textareas from `biography?.[lang] ?? ''`.
export interface ProfessionalProfile {
  biography: LocalizedText | null
  socials: ProfessionalSocials | null
  disciplines: ProfessionalDiscipline[]
}

// Input to save(): the full desired state of the form. The hook diffs each field
// against the loaded profile and omits unchanged keys so the backend's partial
// update keeps them. biography/socials are full replacements (the backend overwrites
// the whole JSONB column when a key is present), so each value is the complete
// desired content, not a per-language/per-platform diff.
export interface SaveProfileInput {
  biography: LocalizedText
  socials: ProfessionalSocials
  discipline_ids: string[]
}

interface UseProfessionalProfileResult {
  profile: ProfessionalProfile | null
  disciplines: ProfessionalDiscipline[]
  loading: boolean
  error: string | null
  saving: boolean
  saveError: string | null
  save: (input: SaveProfileInput) => Promise<boolean>
}

// Backend 400 message strings (stable, from service_errors.go) mapped to i18n keys.
const BACKEND_ERROR_KEYS: Record<string, string> = {
  'One or more discipline IDs do not exist': 'error.invalidDisciplineId',
  'At least one language must be provided': 'error.localizedTextRequired',
  'Invalid JSON payload': 'error.invalidJson',
}

// mapBackendError translates a thrown request() error into a localized message.
// request() throws Error with .status and .data ({ message }); .data.message is the
// stable backend string. Fall back to the raw message, then the generic save error.
function mapBackendError(err: any): string {
  const message = err?.data?.message ?? err?.message ?? ''
  if (message && BACKEND_ERROR_KEYS[message]) {
    return i18n.t(BACKEND_ERROR_KEYS[message])
  }
  return i18n.t('error.updateProfileFailed')
}

// shallowEqualRecords compares two string-keyed maps by value. Used to decide whether
// a field changed (so unchanged biography/socials/disciplines are omitted from the
// PATCH body — the backend keeps omitted fields via COALESCE).
function shallowEqualRecords(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
): boolean {
  const aKeys = a ? Object.keys(a) : []
  const bKeys = b ? Object.keys(b) : []
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a![k] !== b![k]) return false
  }
  return true
}

function shallowEqualStringSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  for (const x of a) {
    if (!setB.has(x)) return false
  }
  return true
}

export function useProfessionalProfile(): UseProfessionalProfileResult {
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [disciplines, setDisciplines] = useState<ProfessionalDiscipline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load profile + discipline catalog in parallel on mount.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [profileData, disciplinesData] = await Promise.all([
          apiService.getProfessionalProfile() as Promise<ProfessionalProfile>,
          apiService.getDisciplines() as Promise<{ disciplines: ProfessionalDiscipline[] }>,
        ])
        if (cancelled) return
        setProfile({
          biography: profileData.biography ?? null,
          socials: profileData.socials ?? null,
          disciplines: profileData.disciplines ?? [],
        })
        setDisciplines(disciplinesData.disciplines ?? [])
      } catch (err: any) {
        if (cancelled) return
        setError(i18n.t('error.loadProfileFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(
    async (input: SaveProfileInput): Promise<boolean> => {
      setSaveError(null)
      if (!profile) return false

      // Build the PATCH body with only changed keys (omit → backend keeps existing).
      // biography/socials are full replacements: each sent value is the complete
      // desired content. biography can't be cleared (backend 400s null/{}), so an
      // all-empty biography map is just omitted (no change). socials CAN be cleared
      // via explicit null. discipline_ids [] clears links; non-empty replaces.
      const body: {
        biography?: LocalizedText
        socials?: ProfessionalSocials | null
        discipline_ids?: string[]
      } = {}

      // biography: drop empty languages, then compare to loaded. Empty result → omit.
      const bioMap: LocalizedText = {}
      for (const [lang, text] of Object.entries(input.biography)) {
        if (text && text.trim()) bioMap[lang] = text.trim()
      }
      const loadedBio = profile.biography ?? {}
      if (Object.keys(bioMap).length > 0 && !shallowEqualRecords(bioMap, loadedBio)) {
        body.biography = bioMap
      }

      // socials: drop empty platforms. Empty result → send null (clears the column).
      // Equal to loaded → omit. Otherwise send the full map.
      const socMap: ProfessionalSocials = {}
      for (const [platform, url] of Object.entries(input.socials)) {
        if (url && url.trim()) (socMap as Record<string, string>)[platform] = url.trim()
      }
      const loadedSoc = profile.socials ?? {}
      const socKeys = Object.keys(socMap)
      if (socKeys.length === 0) {
        // Only send null to clear if the loaded socials actually had content.
        if (Object.keys(loadedSoc).length > 0) {
          body.socials = null
        }
      } else if (!shallowEqualRecords(socMap, loadedSoc)) {
        body.socials = socMap
      }

      // discipline_ids: [] clears; non-empty replaces; equal to loaded → omit.
      const loadedDisciplineIds = profile.disciplines.map((d) => d.id)
      if (!shallowEqualStringSets(input.discipline_ids, loadedDisciplineIds)) {
        body.discipline_ids = input.discipline_ids
      }

      // No-op guard: nothing changed → don't hit the API (avoids an empty-body 400
      // and a wasteful round trip). Signal "nothing to save" to the caller.
      if (Object.keys(body).length === 0) {
        return false
      }

      setSaving(true)
      try {
        await apiService.updateProfessionalProfile(body)

        // Optimistically update local state so the form reflects the saved values
        // without a refetch, and so a subsequent no-change save is a true no-op.
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                biography: body.biography !== undefined ? body.biography : prev.biography,
                socials: body.socials !== undefined ? (body.socials as any) ?? {} : prev.socials,
                disciplines:
                  body.discipline_ids !== undefined
                    ? disciplines.filter((d) => body.discipline_ids!.includes(d.id))
                    : prev.disciplines,
              }
            : prev
        )

        const tg = (window as any).Telegram?.WebApp
        if (tg) {
          tg.HapticFeedback.notificationOccurred('success')
        }
        return true
      } catch (err: any) {
        setSaveError(mapBackendError(err))
        return false
      } finally {
        setSaving(false)
      }
    },
    [profile, disciplines]
  )

  return {
    profile,
    disciplines,
    loading,
    error,
    saving,
    saveError,
    save,
  }
}
