import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Loader2, AlertCircle, Check, Save } from 'lucide-react'
import { useProfessionalProfile } from '../../../hooks/professionals/useProfessionalProfile'
import './ProfessionalProfile.css'

interface ProfessionalProfileProps {
  user: any
}

export default function ProfessionalProfile({ user }: ProfessionalProfileProps) {
  const { t } = useTranslation()
  const { profile, loading, error, refetch, saveProfile } = useProfessionalProfile()
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setStartTime(profile.preferred_start_time || '09:00')
      setEndTime(profile.preferred_end_time || '18:00')
    }
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)

    const result = await saveProfile({
      preferred_start_time: startTime,
      preferred_end_time: endTime,
    })

    setSaving(false)
    if (result.success) {
      setSaveMessage(t('professional.profile.saveSuccess'))
    } else {
      setSaveMessage(result.error || t('professional.profile.saveError'))
    }
  }

  const canSave = startTime && endTime && startTime < endTime

  return (
    <div className="profile-container">
      <div className="profile-wrapper">
        <header className="profile-header">
          <h1>{t('professional.profile.title')}</h1>
        </header>

        <div className="profile-content">
          {loading ? (
            <div className="profile-status">
              <Loader2 size={32} className="spinner" />
              <p>{t('professional.profile.loading')}</p>
            </div>
          ) : error ? (
            <div className="profile-status profile-error">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button className="btn btn-secondary" onClick={refetch}>
                {t('common.tryAgain')}
              </button>
            </div>
          ) : (
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-user-block">
                  <Clock size={20} />
                  <span>{user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email : ''}</span>
                </div>
              </div>

              <div className="profile-form">
                <div className="field-group">
                  <label htmlFor="preferred-start-time" className="field-label">
                    {t('professional.profile.startTime')}
                  </label>
                  <input
                    id="preferred-start-time"
                    type="time"
                    step="60"
                    className="profile-input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="preferred-end-time" className="field-label">
                    {t('professional.profile.endTime')}
                  </label>
                  <input
                    id="preferred-end-time"
                    type="time"
                    step="60"
                    className="profile-input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="profile-note">
                <p>{t('professional.profile.helpText')}</p>
              </div>

              {!canSave && (
                <div className="profile-validation">
                  <AlertCircle size={16} />
                  <span>{t('common.error')}</span>
                </div>
              )}

              <div className="profile-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || !canSave}
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      {t('professional.profile.saving')}
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {t('professional.profile.save')}
                    </>
                  )}
                </button>
              </div>

              {saveMessage && (
                <div className={`profile-save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
                  {saveMessage.includes('success') ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{saveMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
