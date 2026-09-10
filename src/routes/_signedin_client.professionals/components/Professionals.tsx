import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, ChevronLeft, ChevronRight, Loader2, AlertCircle, Calendar, Info } from 'lucide-react'
import { useProfessionals, pickLocalized, type GetProfessionalsResponseItem } from '../hooks/useProfessionals'
import ProfessionalTimetableModal from './ProfessionalTimetableModal'
import ProfessionalInfoModal from './ProfessionalInfoModal'
import './Professionals.css'

export default function Professionals() {
  const { t } = useTranslation()
  const [timetableModalOpen, setTimetableModalOpen] = useState(false)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [selectedProfessional, setSelectedProfessional] = useState<GetProfessionalsResponseItem | null>(null)

  const allProfessionals = useProfessionals(15, true)

  const handleViewTimetable = (professional: GetProfessionalsResponseItem) => {
    setSelectedProfessional(professional)
    setTimetableModalOpen(true)
  }

  const handleViewInfo = (professional: GetProfessionalsResponseItem) => {
    setSelectedProfessional(professional)
    setInfoModalOpen(true)
  }

  const handleCloseTimetableModal = () => {
    setTimetableModalOpen(false)
    setSelectedProfessional(null)
  }

  const handleCloseInfoModal = () => {
    setInfoModalOpen(false)
    setSelectedProfessional(null)
  }

  const renderAllProfessionals = () => {
    if (allProfessionals.loading) {
      return (
        <div className="coaches-status">
          <Loader2 size={32} className="spinner" />
          <p>{t('client.professionals.all.loading')}</p>
        </div>
      )
    }

    if (allProfessionals.error) {
      return (
        <div className="coaches-status coaches-error">
          <AlertCircle size={32} />
          <p>{allProfessionals.error}</p>
          <button className="btn btn-primary" onClick={allProfessionals.refetch}>
            {t('common.tryAgain')}
          </button>
        </div>
      )
    }

    if (allProfessionals.professionals.length === 0) {
      return (
        <div className="coaches-status">
          <Users size={40} className="empty-icon" />
          <p>{t('client.professionals.all.noProfessionals')}</p>
        </div>
      )
    }

    return (
      <>
        <div className="coaches-list">
          {allProfessionals.professionals.map((prof) => (
            <div key={prof.id} className="coach-card">
              <div className="coach-avatar">
                {prof.first_name?.[0]}{prof.last_name?.[0]}
              </div>
              <div className="coach-info">
                <span className="coach-name">{prof.first_name} {prof.last_name}</span>
                {prof.disciplines && prof.disciplines.length > 0 && (
                  <div className="coach-disciplines">
                    {prof.disciplines.map((d) => (
                      <span key={d.id} className="coach-discipline-chip">{pickLocalized(d.name)}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="coach-actions">
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleViewInfo(prof)}
                  title={t('client.professionals.viewInfo')}
                >
                  <Info size={16} />
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleViewTimetable(prof)}
                  title={t('client.professionals.viewTimetable')}
                >
                  <Calendar size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {allProfessionals.pagination && allProfessionals.pagination.has_next_page && (
          <div className="coaches-pagination">
            <button
              className="btn btn-pagination"
              disabled={allProfessionals.page === 1}
              onClick={() => allProfessionals.setPage(allProfessionals.page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="page-indicator">
              {t('common.page')} {allProfessionals.pagination.page}
            </span>
            <button
              className="btn btn-pagination"
              disabled={!allProfessionals.pagination.has_next_page}
              onClick={() => allProfessionals.setPage(allProfessionals.page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="coaches-container">
      <div className="coaches-wrapper">
        <header className="coaches-header">
          <h1>{t('client.professionals.title')}</h1>
        </header>

        <div className="coaches-content">
          {renderAllProfessionals()}
        </div>

        {/* Professional Timetable Modal */}
        {selectedProfessional && timetableModalOpen && (
          <ProfessionalTimetableModal
            professionalID={selectedProfessional.id}
            professionalName={`${selectedProfessional.first_name} ${selectedProfessional.last_name}`}
            isOpen={timetableModalOpen}
            onClose={handleCloseTimetableModal}
          />
        )}

        {/* Professional Info Modal */}
        {selectedProfessional && infoModalOpen && (
          <ProfessionalInfoModal
            professional={selectedProfessional}
            isOpen={infoModalOpen}
            onClose={handleCloseInfoModal}
          />
        )}
      </div>
    </div>
  )
}
