import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, Save, FileText, Share2, Dumbbell, ChevronDown } from 'lucide-react'
import { useProfessionalProfile, type SaveProfileInput } from '../hooks/useProfessionalProfile'
import { pickLocalized } from '../../_signedin_client.professionals/hooks/useProfessionals'
import i18n from '../../../i18n/config.js'
import './EditProfile.css'

// The four app locales, used to render one biography textarea per language.
// Biography is a {lang: text} map; a language left empty is omitted from the
// saved map (the backend requires at least one non-empty language).
const BIO_LANGS = ['en', 'ru', 'uk', 'pl'] as const

// Social platforms the form exposes. socials is a platform->URL map; an empty
// platform is dropped, and if all are empty the hook sends null to clear the column.
const SOCIAL_PLATFORMS = ['instagram', 'telegram', 'whatsapp'] as const

const LANG_LABELS: Record<string, string> = {
  en: 'EN',
  ru: 'RU',
  uk: 'UK',
  pl: 'PL',
}

interface EditProfileProps {
  professionalID: string
}

export default function EditProfile({ professionalID: _professionalID }: EditProfileProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, disciplines, loading, error, saving, saveError, save } = useProfessionalProfile()

  // Form state. biography is one string per language; socials one string per platform;
  // selectedDisciplines is a Set of discipline ids. Seeded from the loaded profile once
  // it arrives. `profile` stays the same object reference between saves (the hook updates
  // it in place on save), so the effect re-seeds only on the initial load (profile goes
  // null -> object).
  const [bioByLang, setBioByLang] = useState<Record<string, string>>({})
  const [socialsByPlatform, setSocialsByPlatform] = useState<Record<string, string>>({})
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set())
  // Expand/collapse state for the per-language biography accordions. A language
  // starts expanded if it's the current app language or already has saved text,
  // collapsed otherwise — so an empty fresh profile shows one open textarea rather
  // than four.
  const [bioExpanded, setBioExpanded] = useState<Record<string, boolean>>({})
  const [seeded, setSeeded] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const currentLang = i18n.language?.split('-')[0]

  useEffect(() => {
    if (profile && !seeded) {
      const bio: Record<string, string> = {}
      const expanded: Record<string, boolean> = {}
      for (const lang of BIO_LANGS) {
        const text = profile.biography?.[lang] ?? ''
        bio[lang] = text
        expanded[lang] = lang === currentLang || text.trim().length > 0
      }
      setBioByLang(bio)
      setBioExpanded(expanded)

      const soc: Record<string, string> = {}
      for (const platform of SOCIAL_PLATFORMS) {
        soc[platform] = profile.socials?.[platform] ?? ''
      }
      setSocialsByPlatform(soc)

      setSelectedDisciplines(new Set(profile.disciplines.map((d) => d.id)))
      setSeeded(true)
    }
  }, [profile, seeded, currentLang])

  const toggleBioLang = (lang: string) => {
    setBioExpanded((prev) => ({ ...prev, [lang]: !prev[lang] }))
  }

  const toggleDiscipline = (id: string) => {
    setSelectedDisciplines((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSavedMessage(null)
    const input: SaveProfileInput = {
      biography: bioByLang,
      socials: socialsByPlatform,
      discipline_ids: Array.from(selectedDisciplines),
    }
    const changed = await save(input)
    if (changed) {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('professional.profile.saved'))
      } else {
        setSavedMessage(t('professional.profile.saved'))
      }
    } else if (!saveError) {
      // No-op guard: nothing changed. Tell the user rather than silently doing nothing.
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('professional.profile.nothingToSave'))
      } else {
        setSavedMessage(t('professional.profile.nothingToSave'))
      }
    }
  }

  const handleBack = () => {
    navigate('/professional/dashboard')
  }

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-wrapper">
          <div className="profile-status">
            <Loader2 size={32} className="spinner" />
            <p>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="profile-wrapper">
          <div className="profile-status profile-error">
            <AlertCircle size={32} />
            <p>{error}</p>
            <button className="btn btn-primary" onClick={handleBack}>
              {t('common.backToDashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-container">
      <div className="profile-wrapper">
        <header className="profile-header">
          <h1>{t('professional.profile.title')}</h1>
        </header>

        <div className="profile-content">
          {/* Biography — one collapsible row per locale. A language starts
              expanded if it's the current app language or already has text. */}
          <section className="profile-section">
            <label className="profile-label">
              <FileText size={16} />
              {t('professional.profile.biography')}
            </label>
            <div className="profile-bio-accordion">
              {BIO_LANGS.map((lang) => {
                const isOpen = !!bioExpanded[lang]
                const text = bioByLang[lang] ?? ''
                const preview = text.trim()
                  ? text.length > 40
                    ? text.slice(0, 40) + '…'
                    : text
                  : ''
                return (
                  <div
                    key={lang}
                    className={`profile-bio-row${isOpen ? ' open' : ''}`}
                  >
                    <button
                      type="button"
                      className="profile-bio-header"
                      onClick={() => toggleBioLang(lang)}
                      aria-expanded={isOpen}
                    >
                      <span className="profile-bio-lang">{LANG_LABELS[lang]}</span>
                      {preview && <span className="profile-bio-preview">{preview}</span>}
                      <ChevronDown
                        size={18}
                        className={`profile-bio-chevron${isOpen ? ' open' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <textarea
                        className="profile-textarea profile-bio-textarea"
                        value={text}
                        onChange={(e) =>
                          setBioByLang((prev) => ({ ...prev, [lang]: e.target.value }))
                        }
                        placeholder={t('professional.profile.biographyPlaceholder')}
                        rows={3}
                        disabled={saving}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Socials — one input per platform */}
          <section className="profile-section">
            <label className="profile-label">
              <Share2 size={16} />
              {t('professional.profile.socials')}
            </label>
            <div className="profile-socials">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform} className="profile-social-field">
                  <span className="profile-social-platform">
                    {t(`professional.profile.socialsPlatforms.${platform}`)}
                  </span>
                  <input
                    type="text"
                    className="profile-input"
                    value={socialsByPlatform[platform] ?? ''}
                    onChange={(e) =>
                      setSocialsByPlatform((prev) => ({ ...prev, [platform]: e.target.value }))
                    }
                    placeholder={`@${platform}`}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Disciplines — multi-select toggle chips from the catalog */}
          <section className="profile-section">
            <label className="profile-label">
              <Dumbbell size={16} />
              {t('professional.profile.disciplines')}
            </label>
            {disciplines.length === 0 ? (
              <p className="profile-empty-hint">{t('professional.profile.disciplinesHint')}</p>
            ) : (
              <div className="profile-disciplines">
                {disciplines.map((d) => {
                  const selected = selectedDisciplines.has(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className={`coach-discipline-chip profile-discipline-chip${
                        selected ? ' selected' : ''
                      }`}
                      onClick={() => toggleDiscipline(d.id)}
                      disabled={saving}
                    >
                      {pickLocalized(d.name)}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Save error (localized backend 400/500) */}
          {saveError && (
            <div className="profile-error-inline">
              <AlertCircle size={16} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Success / no-op message (when Telegram alerts aren't available) */}
          {savedMessage && !saveError && (
            <div className="profile-success-inline">{savedMessage}</div>
          )}

          {/* Save */}
          <button
            className="btn-profile-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="spinner" />
                {t('professional.profile.saving')}
              </>
            ) : (
              <>
                <Save size={18} />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
