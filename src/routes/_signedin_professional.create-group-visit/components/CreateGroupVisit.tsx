import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, Loader2, AlertCircle, CalendarPlus, Users, Calendar, Check, FileText, Tag } from 'lucide-react'
import { useGroupVisit } from '../hooks/useGroupVisit'
import { generateAvailableDates } from '../../../utils/date'
import { formatDate, formatTime } from '../../../utils/i18n'
import './CreateGroupVisit.css'

interface CreateGroupVisitProps {
  professionalID: string
}

export default function CreateGroupVisit({ professionalID }: CreateGroupVisitProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const {
    selectedDate,
    setSelectedDate,
    availableSlots,
    slotsLoading,
    slotsError,
    selectedSlot,
    setSelectedSlot,
    type,
    setType,
    clients,
    clientsLoading,
    clientsError,
    selectedClients,
    setSelectedClients,
    handleClientChange,
    searchClients,
    description,
    setDescription,
    createGroupVisit,
    creating,
    error,
  } = useGroupVisit(professionalID)

  const [clientSearch, setClientSearch] = useState('')

  const dates = generateAvailableDates(currentMonth)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isCurrentMonth = currentMonth.getMonth() === today.getMonth() &&
    currentMonth.getFullYear() === today.getFullYear()

  const validClients = clients.filter(s => s.chat_id !== null)
  const filteredClients = searchClients(clientSearch).filter(s => s.chat_id !== null)
  const hasClientsSelected = selectedClients.size > 0

  // Validation: split requires exactly 2 clients, group requires > 2 clients.
  // "Select all" was removed — selection is always explicit now.
  const isValidClientSelection = () => {
    if (!hasClientsSelected) return false
    if (type === 'split') {
      return selectedClients.size === 2
    } else { // group
      return selectedClients.size > 2
    }
  }

  const getClientValidationError = () => {
    if (!hasClientsSelected) return null
    if (type === 'split') {
      // Only show error if user has started selecting (at least 1 client selected)
      if (selectedClients.size > 0 && selectedClients.size < 2) {
        return t('professional.createGroupVisit.description.splitNeedTwoClients')
      }
      if (selectedClients.size > 2) {
        return t('professional.createGroupVisit.description.splitMaxTwoClients')
      }
    } else { // group
      // Only show error if user has started selecting but hasn't met the requirement
      if (selectedClients.size > 0 && selectedClients.size <= 2) {
        return t('professional.createGroupVisit.description.groupNeedMoreThanTwoClients')
      }
    }
    return null
  }

  const clientValidationError = getClientValidationError()

  // Set pre-defined description when type changes
  useEffect(() => {
    if (selectedSlot) {
      const predefinedDescription = type === 'group'
        ? t('professional.createGroupVisit.description.predefinedGroup')
        : t('professional.createGroupVisit.description.predefinedSplit')
      setDescription(predefinedDescription)
    }
  }, [type, selectedSlot, t, setDescription])


  const handlePrevMonth = () => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    setCurrentMonth(prev)
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(next)
    setSelectedDate(null)
  }

  const handleConfirm = async () => {
    if (!description.trim()) {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('professional.createGroupVisit.description.descriptionRequired'))
      }
      return
    }
    if (validClients.length > 0 && !hasClientsSelected) {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('professional.createGroupVisit.description.selectClientsRequired'))
      }
      return
    }
    if (validClients.length > 0 && !isValidClientSelection()) {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(clientValidationError || t('professional.createGroupVisit.description.selectClientsRequired'))
      }
      return
    }
    await createGroupVisit(() => {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('common.groupVisitCreated'))
      }
      navigate('/professional/dashboard', { replace: true })
    })
  }

  const canConfirm = selectedDate && selectedSlot && description.trim() &&
    (validClients.length === 0 || isValidClientSelection())

  return (
    <div className="gv-container">
      <div className="gv-wrapper">
        <header className="gv-header">
          <h1>{t('professional.createGroupVisit.title')}</h1>
        </header>

        {/* Calendar */}
        <section className="gv-section">
          <div className="calendar-header">
            <button
              className="btn-month-nav"
              disabled={isCurrentMonth}
              onClick={handlePrevMonth}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="calendar-month">
              {formatDate(currentMonth, { month: 'long', year: 'numeric' })}
            </span>
            <button className="btn-month-nav" onClick={handleNextMonth}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="calendar-grid">
            {dates.map((date) => {
              const dateObj = new Date(date + 'T00:00:00')
              const day = dateObj.getDate()
              const weekday = formatDate(dateObj, { weekday: 'short' })
              const isSelected = date === selectedDate
              const isToday = date === todayStr

              return (
                <button
                  key={date}
                  className={`calendar-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="day-number">{day}</span>
                  <span className="day-weekday">{weekday}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Available slots */}
        {selectedDate && (
          <section className="gv-section">
            <label className="gv-label">
              <Clock size={16} />
              {t('professional.createGroupVisit.selectTime.titleStart')}
            </label>

            {slotsLoading ? (
              <div className="slots-status">
                <Loader2 size={24} className="spinner" />
              </div>
            ) : slotsError ? (
              <div className="slots-status slots-error">
                <AlertCircle size={20} />
                <span>{slotsError}</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="slots-status">
                <p>{t('professional.createGroupVisit.selectTime.noSlots')}</p>
              </div>
            ) : (
              <div className="slots-grid">
                {availableSlots.map((slot, i) => {
                  const isSelected = selectedSlot?.start_time === slot.start_time
                    && selectedSlot?.end_time === slot.end_time
                  return (
                    <button
                      key={i}
                      className={`slot-btn${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Type */}
        {selectedSlot && (
          <section className="gv-section">
            <label className="gv-label">
              <Tag size={16} />
              {t('professional.createGroupVisit.description.type')}
            </label>
            <select
              className="gv-select"
              value={type}
              onChange={(e) => {
                const newType = e.target.value as 'split' | 'group'
                // Split allows at most 2 clients — clear the selection on the
                // type switch so the user can re-pick a valid pair instead of
                // keeping a >2 selection that silently can't be submitted.
                if (newType === 'split' && selectedClients.size > 2) {
                  setSelectedClients(new Set())
                }
                setType(newType)
              }}
              disabled={creating}
            >
              <option value="group">{t('professional.createGroupVisit.description.typeGroup')}</option>
              <option value="split">{t('professional.createGroupVisit.description.typeSplit')}</option>
            </select>
          </section>
        )}

        {/* Clients */}
        {selectedSlot && (
          <section className="gv-section">
            <label className="gv-label">
              <Users size={16} />
              {t('professional.createGroupVisit.description.clients')}
            </label>
            {clientsLoading ? (
              <div className="slots-status">
                <Loader2 size={18} className="spinner" />
              </div>
            ) : clientsError ? (
              <div className="slots-status slots-error">
                <AlertCircle size={20} />
                <span>{clientsError}</span>
              </div>
            ) : validClients.length === 0 ? (
              <p className="gv-empty-hint">{t('professional.createGroupVisit.description.noClients')}</p>
            ) : (
              <div className="gv-clients-selector">
                <input
                  type="text"
                  className="gv-search-input"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder={t('professional.createGroupVisit.description.searchClients')}
                  disabled={creating}
                />
                <div className="gv-clients-list">
                  {filteredClients.map((client) => {
                    const isChecked = selectedClients.has(client.id)
                    const isDisabled = creating || (type === 'split' && !isChecked && selectedClients.size >= 2)
                    return (
                      <label key={client.id} className="gv-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleClientChange(client.id, e.target.checked, type)}
                          disabled={isDisabled}
                        />
                        <span>{client.first_name} {client.last_name}</span>
                      </label>
                    )
                  })}
                </div>
                {clientValidationError && (
                  <div className="gv-validation-error">
                    <AlertCircle size={14} />
                    <span>{clientValidationError}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Description */}
        {selectedSlot && (
          <section className="gv-section">
            <label className="gv-label">
              <FileText size={16} />
              {t('professional.createGroupVisit.description.description')}
            </label>
            <textarea
              className="gv-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('professional.createGroupVisit.description.descriptionPlaceholder')}
              rows={3}
              disabled={creating}
            />
          </section>
        )}

        {/* Summary */}
        {(selectedDate || selectedSlot) && (
          <section className="gv-summary">
            <div className="summary-row">
              <Calendar size={16} />
              <span className="summary-label">{t('common.date')}</span>
              <span className={`summary-value${selectedDate ? ' filled' : ''}`}>
                {selectedDate
                  ? <><Check size={14} className="check-icon" /> {formatDate(new Date(selectedDate + 'T00:00:00'), { weekday: 'short', day: 'numeric', month: 'short' })}</>
                  : '—'}
              </span>
            </div>
            <div className="summary-row">
              <Clock size={16} />
              <span className="summary-label">{t('common.time')}</span>
              <span className={`summary-value${selectedSlot ? ' filled' : ''}`}>
                {selectedSlot
                  ? <><Check size={14} className="check-icon" /> {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}</>
                  : '—'}
              </span>
            </div>
            <div className="summary-row">
              <Tag size={16} />
              <span className="summary-label">{t('professional.createGroupVisit.description.type')}</span>
              <span className={`summary-value${selectedSlot ? ' filled' : ''}`}>
                {selectedSlot
                  ? <><Check size={14} className="check-icon" /> {type === 'group' ? t('professional.createGroupVisit.description.typeGroup') : t('professional.createGroupVisit.description.typeSplit')}</>
                  : '—'}
              </span>
            </div>
            <div className="summary-row">
              <Users size={16} />
              <span className="summary-label">{t('professional.createGroupVisit.description.clients')}</span>
              <span className={`summary-value${hasClientsSelected ? ' filled' : ''}`}>
                {hasClientsSelected
                  ? <><Check size={14} className="check-icon" /> {`${selectedClients.size}`}</>
                  : '—'}
              </span>
            </div>
            <div className="summary-row">
              <FileText size={16} />
              <span className="summary-label">{t('common.description')}</span>
              <span className={`summary-value${description.trim() ? ' filled' : ''}`}>
                {description.trim()
                  ? <><Check size={14} className="check-icon" /> {description.trim().length > 30 ? description.trim().substring(0, 30) + '…' : description.trim()}</>
                  : '—'}
              </span>
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="gv-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Confirm */}
        {canConfirm && (
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={creating}
          >
            {creating
              ? <><Loader2 size={18} className="spinner" /> {t('common.creating')}</>
              : <><CalendarPlus size={18} /> {t('common.create')}</>}
          </button>
        )}
      </div>
    </div>
  )
}
