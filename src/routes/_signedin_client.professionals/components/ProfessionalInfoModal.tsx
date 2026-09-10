import React from 'react'
import { useTranslation } from 'react-i18next'
import { X, FileText, Dumbbell, Share2, Inbox } from 'lucide-react'
import {
  type GetProfessionalsResponseItem,
  pickLocalized,
} from '../hooks/useProfessionals'
import './ProfessionalInfoModal.css'

interface ProfessionalInfoModalProps {
  professional: GetProfessionalsResponseItem
  isOpen: boolean
  onClose: () => void
}

export default function ProfessionalInfoModal({
  professional,
  isOpen,
  onClose,
}: ProfessionalInfoModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const fullName = `${professional.first_name} ${professional.last_name}`
  const biography = pickLocalized(professional.biography)
  const disciplines = professional.disciplines || []
  const socials = professional.socials || null

  const socialEntries: { key: string; label: string; url: string }[] = []
  if (socials) {
    if (socials.telegram) socialEntries.push({ key: 'telegram', label: 'Telegram', url: socials.telegram })
    if (socials.whatsapp) socialEntries.push({ key: 'whatsapp', label: 'WhatsApp', url: socials.whatsapp })
    if (socials.instagram) socialEntries.push({ key: 'instagram', label: 'Instagram', url: socials.instagram })
  }

  const hasAny = Boolean(biography) || disciplines.length > 0 || socialEntries.length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content professional-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="professional-info-modal-header">
          <h2>{t('client.professionals.info.title', { name: fullName })}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="professional-info-modal-body">
          {!hasAny ? (
            <div className="professional-info-empty">
              <Inbox size={40} className="empty-icon" />
              <p>{t('client.professionals.info.noInfo')}</p>
            </div>
          ) : (
            <div className="professional-info-sections">
              {biography && (
                <section className="professional-info-section">
                  <h3 className="professional-info-section-title">
                    <FileText size={16} />
                    {t('client.professionals.info.biography')}
                  </h3>
                  <p className="professional-info-biography">{biography}</p>
                </section>
              )}

              {disciplines.length > 0 && (
                <section className="professional-info-section">
                  <h3 className="professional-info-section-title">
                    <Dumbbell size={16} />
                    {t('client.professionals.info.disciplines')}
                  </h3>
                  <div className="professional-info-disciplines">
                    {disciplines.map((d) => (
                      <span key={d.id} className="coach-discipline-chip">{pickLocalized(d.name)}</span>
                    ))}
                  </div>
                </section>
              )}

              {socialEntries.length > 0 && (
                <section className="professional-info-section">
                  <h3 className="professional-info-section-title">
                    <Share2 size={16} />
                    {t('client.professionals.info.socials')}
                  </h3>
                  <div className="professional-info-socials">
                    {socialEntries.map((s) => (
                      <a
                        key={s.key}
                        className="professional-info-social-link"
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
