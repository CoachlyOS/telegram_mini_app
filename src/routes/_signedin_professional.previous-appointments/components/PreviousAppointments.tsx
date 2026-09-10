import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Calendar from 'react-calendar'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Calendar as CalendarIcon, Tag, Users, Clock, Filter, X, Check, FileText, Edit2, UserPlus, UserMinus } from 'lucide-react'
import { usePreviousAppointments } from '../hooks/usePreviousAppointments'
import { useCancelProfessionalAppointment } from '../../../hooks/professionals/useCancelProfessionalAppointment'
import { useUpdatePreviousAppointment } from '../../../hooks/professionals/useUpdatePreviousAppointment'
import { useClients, Client } from '../../../hooks/professionals/useClients'
import { useAppointmentDetails, AppointmentDetails } from '../hooks/useAppointmentDetails'
import { formatDate, formatTime } from '../../../utils/i18n'
import 'react-calendar/dist/Calendar.css'
import './PreviousAppointments.css'

interface PreviousAppointmentsProps {
  onBack: () => void
}

export default function PreviousAppointments({ onBack }: PreviousAppointmentsProps) {
  const { t } = useTranslation()

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [selectedClientID, setSelectedClientID] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [showDateFromCalendar, setShowDateFromCalendar] = useState(false)
  const [showDateToCalendar, setShowDateToCalendar] = useState(false)

  // Refs for calendar dropdown click outside
  const dateFromRef = useRef<HTMLDivElement>(null)
  const dateToRef = useRef<HTMLDivElement>(null)

  // Format dates for API (YYYY-MM-DD)
  const dateFromStr = dateFrom ? dateFrom.toISOString().split('T')[0] : null
  const dateToStr = dateTo ? dateTo.toISOString().split('T')[0] : null

  // Data hooks
  const { appointments, pagination, loading, error, page, setPage, refetch } = usePreviousAppointments(
    selectedClientID,
    1,
    15,
    dateFromStr,
    dateToStr
  )
  const { clients, loading: clientsLoading, error: clientsError, searchClients } = useClients()
  const { cancelAppointment, canceling, error: cancelError } = useCancelProfessionalAppointment()
  const { updatePreviousAppointment, updating, error: updateError } = useUpdatePreviousAppointment()
  const { getAppointmentDetails, loading: detailsLoading } = useAppointmentDetails()

  // Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAppointmentID, setSelectedAppointmentID] = useState<string | null>(null)
  const [appointmentDetails, setAppointmentDetails] = useState<AppointmentDetails | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [addClientSearch, setAddClientSearch] = useState('')
  const [clientsToAdd, setClientsToAdd] = useState<Set<string>>(new Set())
  const [clientsToRemove, setClientsToRemove] = useState<Set<string>>(new Set())
  const [typeSuggestionDismissed, setTypeSuggestionDismissed] = useState(false)
  const [typeSuggestionAccepted, setTypeSuggestionAccepted] = useState(false)

  // Clients available to add in edit mode: full list minus those already on the
  // appointment (from appointmentDetails.clients), filtered by the search input.
  // Backend no longer returns a scoped "missing clients" list — it returns everyone.
  const existingClientIDs = new Set(appointmentDetails?.clients?.map((c) => c.id) || [])
  const addableClients = searchClients(addClientSearch).filter((c) => !existingClientIDs.has(c.id))

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateFromRef.current && !dateFromRef.current.contains(e.target as Node)) {
        setShowDateFromCalendar(false)
      }
      if (dateToRef.current && !dateToRef.current.contains(e.target as Node)) {
        setShowDateToCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasActiveFilters = selectedClientID !== null || dateFrom !== null || dateTo !== null

  const clearAllFilters = () => {
    setSelectedClientID(null)
    setDateFrom(null)
    setDateTo(null)
  }

  const formatDateDisplay = (date: Date | null): string => {
    if (!date) return ''
    return formatDate(date.toISOString(), { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const handleCancelClick = (appointmentID: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAppointmentID(appointmentID)
    setCancellationReason(t('common.defaultCancelReason'))
    setCancelModalOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!selectedAppointmentID || !cancellationReason.trim()) {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('common.cancelReasonRequired'))
      }
      return
    }

    try {
      await cancelAppointment(selectedAppointmentID, cancellationReason.trim())
      setCancelModalOpen(false)
      setSelectedAppointmentID(null)
      setCancellationReason('')
      await refetch()
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('common.appointmentCancelled'))
      }
    } catch {
      // Error is already handled by the hook
    }
  }

  const handleCancelClose = () => {
    setCancelModalOpen(false)
    setSelectedAppointmentID(null)
    setCancellationReason('')
  }

  const handleViewDetailsClick = async (appointmentID: string) => {
    setSelectedAppointmentID(appointmentID)
    setDetailsModalOpen(true)
    const details = await getAppointmentDetails(appointmentID)
    if (details) {
      setAppointmentDetails(details)
    }
  }

  const handleDetailsClose = () => {
    setDetailsModalOpen(false)
    setSelectedAppointmentID(null)
    setAppointmentDetails(null)
    setIsEditMode(false)
    setClientsToAdd(new Set())
    setClientsToRemove(new Set())
    setTypeSuggestionDismissed(false)
    setTypeSuggestionAccepted(false)
  }

  const handleCancelFromDetails = () => {
    if (!selectedAppointmentID) return
    setDetailsModalOpen(false)
    setCancellationReason(t('common.defaultCancelReason'))
    setCancelModalOpen(true)
  }

  // Edit mode helpers
  const computeNewType = (clientCount: number): string => {
    if (clientCount === 1) return 'personal'
    if (clientCount === 2) return 'split'
    return 'group'
  }

  const handleEnterEditMode = async () => {
    if (!selectedAppointmentID) return
    setIsEditMode(true)
    setClientsToAdd(new Set())
    setClientsToRemove(new Set())
    setAddClientSearch('')
    setTypeSuggestionDismissed(false)
    setTypeSuggestionAccepted(false)
  }

  const handleAcceptTypeSuggestion = () => {
    setTypeSuggestionAccepted(true)
    setTypeSuggestionDismissed(false)
  }

  const handleDismissTypeSuggestion = () => {
    setTypeSuggestionDismissed(true)
    setTypeSuggestionAccepted(false)
  }

  const handleSaveEdit = async () => {
    if (!selectedAppointmentID || !appointmentDetails) return

    const existingCount = appointmentDetails.clients?.length || 0
    const finalCount = existingCount - clientsToRemove.size + clientsToAdd.size

    if (finalCount < 1) {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('professional.editPreviousAppointment.needAtLeastOneClient'))
      }
      return
    }

    const newType = computeNewType(finalCount)

    try {
      await updatePreviousAppointment(selectedAppointmentID, {
        type: newType,
        clients_added: Array.from(clientsToAdd),
        clients_removed: Array.from(clientsToRemove),
      })

      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.showAlert(t('professional.editPreviousAppointment.updateSuccess'))
      }

      // Refresh details and list
      const details = await getAppointmentDetails(selectedAppointmentID)
      if (details) {
        setAppointmentDetails(details)
      }
      setIsEditMode(false)
      setClientsToAdd(new Set())
      setClientsToRemove(new Set())
      await refetch()
    } catch {
      // Error is handled by the hook
    }
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setClientsToAdd(new Set())
    setClientsToRemove(new Set())
    setTypeSuggestionDismissed(false)
    setTypeSuggestionAccepted(false)
  }

  const handleAddClientToggle = (clientId: string) => {
    setClientsToAdd(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const handleRemoveClientToggle = (clientId: string) => {
    setClientsToRemove(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const renderAppointmentType = (type: string) => {
    if (type === 'personal') return t('professional.appointments.types.personal')
    if (type === 'split') return t('professional.appointments.types.split')
    if (type === 'group') return t('professional.appointments.types.group')
    return type
  }

  const renderAppointments = () => {
    if (loading) {
      return (
        <div className="prev-appointments-status">
          <Loader2 size={32} className="spinner" />
          <p>{t('professional.previousAppointments.loading')}</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="prev-appointments-status prev-appointments-error">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={refetch}>
            {t('common.tryAgain')}
          </button>
        </div>
      )
    }

    if (appointments.length === 0) {
      return (
        <div className="prev-appointments-status">
          <CalendarIcon size={40} className="empty-icon" />
          <p>{t('professional.previousAppointments.noAppointments')}</p>
        </div>
      )
    }

    return (
      <>
        <div className="appointments-list">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="appointment-card"
              onClick={() => handleViewDetailsClick(apt.id)}
            >
              <div className="appointment-details">
                {apt.type && (
                  <p className="appointment-type">
                    <strong><Tag size={16} /> {t('professional.appointments.type')}:</strong> {renderAppointmentType(apt.type)}
                  </p>
                )}
                <p className="appointment-date">
                  <strong><CalendarIcon size={16} /> {t('common.date')}:</strong> {formatDate(apt.start_time, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="appointment-time">
                  <strong><Clock size={16} /> {t('common.time')}:</strong> {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                </p>
                {apt.type === 'groupVisit' && apt.users_count > 0 && (
                  <p className="appointment-clients">
                    <strong><Users size={16} /> {t('common.clients')}:</strong> {apt.users_count} {t('professional.appointments.clientsCount')}
                  </p>
                )}
                {apt.description && apt.description.trim() && (
                  <p className="appointment-description">
                    <strong>{t('common.description')}:</strong> {apt.description}
                  </p>
                )}
              </div>
              <div className="appointment-actions">
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => handleCancelClick(apt.id, e)}
                  disabled={canceling}
                >
                  {t('common.cancelAppointment')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {pagination && (pagination.has_next_page || pagination.page > 1 || appointments.length >= pagination.page_size) && (
          <div className="prev-appointments-pagination">
            <button
              className="btn btn-pagination"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
              {t('common.previous')}
            </button>
            <span className="page-indicator">
              {t('common.page')} {pagination.page}
            </span>
            <button
              className="btn btn-pagination"
              disabled={!pagination.has_next_page}
              onClick={() => setPage(page + 1)}
            >
              {t('common.next')}
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="prev-appointments-container">
      <div className="prev-appointments-wrapper">
        <header className="prev-appointments-header">
          <h1>{t('professional.previousAppointments.title')}</h1>
        </header>

        {/* Filter toggle */}
        <button
          className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          style={{ marginBottom: showFilters ? 0 : 24 }}
        >
          <Filter size={16} />
          {t('professional.previousAppointments.filters.toggle')}
        </button>

        {/* Filters section */}
        {showFilters && (
          <div className="prev-appointments-filters">
            {/* Client filter */}
            <div className="filter-row">
              <span className="filter-label">
                <Users size={14} />
                {t('professional.previousAppointments.filters.byClient')}
              </span>
              <select
                className="filter-select"
                value={selectedClientID || ''}
                onChange={(e) => setSelectedClientID(e.target.value || null)}
              >
                <option value="">{t('professional.previousAppointments.filters.allClients')}</option>
                {clients.map((sub: Client) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.first_name} {sub.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from filter */}
            <div className="filter-row">
              <span className="filter-label">
                <CalendarIcon size={14} />
                {t('professional.previousAppointments.filters.dateFrom')}
              </span>
              <div className="calendar-picker-wrapper" ref={dateFromRef}>
                <button
                  className={`calendar-trigger ${dateFrom ? 'has-value' : 'placeholder'}`}
                  onClick={() => {
                    setShowDateFromCalendar(!showDateFromCalendar)
                    setShowDateToCalendar(false)
                  }}
                >
                  <CalendarIcon size={16} />
                  {dateFrom ? formatDateDisplay(dateFrom) : t('professional.previousAppointments.filters.selectDate')}
                  {dateFrom && (
                    <button
                      className="clear-date-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDateFrom(null)
                        setShowDateFromCalendar(false)
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </button>
                {showDateFromCalendar && (
                  <div className="calendar-dropdown">
                    <Calendar
                      onChange={(value) => {
                        setDateFrom(value as Date)
                        setShowDateFromCalendar(false)
                      }}
                      value={dateFrom}
                      maxDate={dateTo || new Date()}
                      locale={undefined}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Date to filter */}
            <div className="filter-row">
              <span className="filter-label">
                <CalendarIcon size={14} />
                {t('professional.previousAppointments.filters.dateTo')}
              </span>
              <div className="calendar-picker-wrapper" ref={dateToRef}>
                <button
                  className={`calendar-trigger ${dateTo ? 'has-value' : 'placeholder'}`}
                  onClick={() => {
                    setShowDateToCalendar(!showDateToCalendar)
                    setShowDateFromCalendar(false)
                  }}
                >
                  <CalendarIcon size={16} />
                  {dateTo ? formatDateDisplay(dateTo) : t('professional.previousAppointments.filters.selectDate')}
                  {dateTo && (
                    <button
                      className="clear-date-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDateTo(null)
                        setShowDateToCalendar(false)
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </button>
                {showDateToCalendar && (
                  <div className="calendar-dropdown">
                    <Calendar
                      onChange={(value) => {
                        setDateTo(value as Date)
                        setShowDateToCalendar(false)
                      }}
                      value={dateTo}
                      minDate={dateFrom || undefined}
                      maxDate={new Date()}
                      locale={undefined}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Active filters indicator */}
            {hasActiveFilters && (
              <div className="filters-active-bar">
                <span className="filters-active-text">
                  {t('professional.previousAppointments.filters.active')}
                </span>
                <button className="clear-filters-btn" onClick={clearAllFilters}>
                  {t('professional.previousAppointments.filters.clearAll')}
                </button>
              </div>
            )}
          </div>
        )}

        {cancelError && <div className="error-message">{cancelError}</div>}

        <div className="prev-appointments-content">
          {renderAppointments()}
        </div>

        {/* Details Modal */}
        {detailsModalOpen && (() => {
          const existingCount = appointmentDetails?.clients?.length || 0
          const finalCount = existingCount - clientsToRemove.size + clientsToAdd.size
          const newType = computeNewType(finalCount)
          const hasChanges = clientsToAdd.size > 0 || clientsToRemove.size > 0 || typeSuggestionAccepted
          // Compute suggested type for view mode (based on current client count)
          const suggestedType = appointmentDetails ? computeNewType(existingCount) : null
          const shouldSuggestType = appointmentDetails && suggestedType && appointmentDetails.type !== suggestedType
          const showTypeSuggestionInEdit = isEditMode && shouldSuggestType && !typeSuggestionDismissed && !hasChanges

          return (
          <div className="modal-overlay" onClick={handleDetailsClose}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <h2>{isEditMode ? t('professional.editPreviousAppointment.title') : t('common.appointmentDetails')}</h2>
              {detailsLoading ? (
                <div className="loading">{t('common.loading')}</div>
              ) : appointmentDetails ? (
                <div className="appointment-details-content">
                  <section className="gv-summary">
                    <div className="summary-row">
                      <CalendarIcon size={16} />
                      <span className="summary-label">{t('common.date')}</span>
                      <span className="summary-value filled">
                        <Check size={14} className="check-icon" />
                        {formatDate(appointmentDetails.start_time, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="summary-row">
                      <Clock size={16} />
                      <span className="summary-label">{t('common.time')}</span>
                      <span className="summary-value filled">
                        <Check size={14} className="check-icon" />
                        {formatTime(appointmentDetails.start_time)} – {formatTime(appointmentDetails.end_time)}
                      </span>
                    </div>
                    {!isEditMode && appointmentDetails.type && (
                      <div className="summary-row">
                        <Tag size={16} />
                        <span className="summary-label">{t('professional.appointments.type')}</span>
                        <span className="summary-value filled">
                          <Check size={14} className="check-icon" />
                          {t(`professional.appointments.types.${appointmentDetails.type}`)}
                        </span>
                      </div>
                    )}
                    {!isEditMode && appointmentDetails.clients && appointmentDetails.clients.length > 0 && (
                      <div className="summary-row">
                        <Users size={16} />
                        <span className="summary-label">{t('common.clients')}</span>
                        <span className="summary-value filled">
                          <Check size={14} className="check-icon" />
                          {appointmentDetails.clients.length} {t('professional.appointments.clientsCount')}
                        </span>
                      </div>
                    )}
                    {!isEditMode && appointmentDetails.description && appointmentDetails.description.trim() && (
                      <div className="summary-row">
                        <FileText size={16} />
                        <span className="summary-label">{t('common.description')}</span>
                        <span className="summary-value filled">
                          <Check size={14} className="check-icon" />
                          {appointmentDetails.description.trim().length > 30 ? appointmentDetails.description.trim().substring(0, 30) + '…' : appointmentDetails.description.trim()}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* View mode: clients list */}
                  {!isEditMode && appointmentDetails.clients && appointmentDetails.clients.length > 0 && (
                    <div className="detail-section">
                      <h3 className="detail-section-title">
                        {t('common.clients')} ({appointmentDetails.clients.length})
                      </h3>
                      <div className="clients-list">
                        {appointmentDetails.clients.map((client) => (
                          <div key={client.id} className="client-item">
                            {client.first_name} {client.last_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View mode: type suggestion banner */}
                  {!isEditMode && shouldSuggestType && (
                    <div className="type-suggestion-banner">
                      <Tag size={14} />
                      {t('professional.editPreviousAppointment.suggestedType', {
                        type: t(`professional.appointments.types.${suggestedType}`),
                        count: existingCount,
                      })}
                    </div>
                  )}

                  {/* Edit mode: existing clients with removal checkboxes */}
                  {isEditMode && appointmentDetails.clients && appointmentDetails.clients.length > 0 && (
                    <>
                      <div className="edit-section-label">
                        <UserMinus size={16} />
                        {t('professional.editPreviousAppointment.existingClients')} ({appointmentDetails.clients.length})
                      </div>
                      <div className="modal-clients-selector">
                        {appointmentDetails.clients.map((client) => (
                          <label key={client.id} className="modal-checkbox-label">
                            <input
                              type="checkbox"
                              checked={clientsToRemove.has(client.id)}
                              onChange={() => handleRemoveClientToggle(client.id)}
                              disabled={updating}
                            />
                            <span className={clientsToRemove.has(client.id) ? 'client-removed' : ''}>
                              {client.first_name} {client.last_name}
                              {clientsToRemove.has(client.id) && (
                                <span> — {t('professional.editPreviousAppointment.willBeRemoved')}</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Edit mode: add clients */}
                  {isEditMode && (
                    <>
                      <div className="edit-section-label">
                        <UserPlus size={16} />
                        {t('professional.editPreviousAppointment.addClients')}
                      </div>
                      {clientsLoading ? (
                        <p className="loading">{t('common.loading')}</p>
                      ) : addableClients.length === 0 ? (
                        <p className="modal-subtitle">{t('professional.editPreviousAppointment.noClientsToAdd')}</p>
                      ) : (
                        <>
                          <div className="modal-client-search">
                            <input
                              type="text"
                              className="modal-client-search-input"
                              value={addClientSearch}
                              onChange={(e) => setAddClientSearch(e.target.value)}
                              placeholder={t('professional.editPreviousAppointment.searchClients')}
                              disabled={updating}
                            />
                          </div>
                          <div className="modal-clients-selector">
                            {addableClients.map((client) => (
                              <label key={client.id} className="modal-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={clientsToAdd.has(client.id)}
                                  onChange={() => handleAddClientToggle(client.id)}
                                  disabled={updating}
                                />
                                {client.first_name} {client.last_name}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Edit mode: interactive type suggestion before changes */}
                  {showTypeSuggestionInEdit && (
                    <div className="type-suggestion-interactive">
                      <div className="type-suggestion-content">
                        <Tag size={14} />
                        <span>
                          {t('professional.editPreviousAppointment.suggestedType', {
                            type: t(`professional.appointments.types.${suggestedType}`),
                            count: existingCount,
                          })}
                        </span>
                      </div>
                      <div className="type-suggestion-actions">
                        <button
                          className="btn-suggestion-action btn-accept"
                          onClick={handleAcceptTypeSuggestion}
                          title={t('common.accept')}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="btn-suggestion-action btn-dismiss"
                          onClick={handleDismissTypeSuggestion}
                          title={t('common.dismiss')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit mode: accepted suggestion confirmation */}
                  {isEditMode && !hasChanges && typeSuggestionAccepted && shouldSuggestType && (
                    <div className="type-suggestion-accepted">
                      <Check size={14} />
                      <span>
                        {t('professional.editPreviousAppointment.typeSuggestionAccepted', {
                          type: t(`professional.appointments.types.${suggestedType}`),
                        })}
                      </span>
                    </div>
                  )}

                  {/* Edit mode: auto-computed type banner after changes */}
                  {isEditMode && hasChanges && finalCount >= 1 && (
                    <div className="type-auto-update">
                      <Tag size={14} />
                      {t('professional.editPreviousAppointment.typeAutoUpdate', {
                        type: t(`professional.appointments.types.${newType}`),
                        count: finalCount,
                      })}
                    </div>
                  )}

                  {/* Edit mode: validation error */}
                  {isEditMode && hasChanges && finalCount < 1 && (
                    <div className="edit-validation-error">
                      {t('professional.editPreviousAppointment.needAtLeastOneClient')}
                    </div>
                  )}

                  {updateError && <div className="error-message">{updateError}</div>}
                </div>
              ) : (
                <div className="error-message">{t('error.loadAppointmentsFailed')}</div>
              )}
              <div className="modal-actions">
                {appointmentDetails && (
                  isEditMode ? (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={handleCancelEdit}
                        disabled={updating}
                      >
                        {t('professional.editPreviousAppointment.cancelEdit')}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveEdit}
                        disabled={updating || !hasChanges || finalCount < 1}
                      >
                        {updating ? t('professional.editPreviousAppointment.saving') : t('professional.editPreviousAppointment.saveButton')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={handleEnterEditMode}
                      >
                        <Edit2 size={14} />
                        {t('professional.editPreviousAppointment.editButton')}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={handleCancelFromDetails}
                        disabled={canceling}
                      >
                        {t('common.cancelAppointment')}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleDetailsClose}
                        disabled={canceling}
                      >
                        {t('common.close')}
                      </button>
                    </>
                  )
                )}
                {!appointmentDetails && !detailsLoading && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleDetailsClose}
                  >
                    {t('common.close')}
                  </button>
                )}
              </div>
            </div>
          </div>
          )
        })()}

        {/* Cancel Modal */}
        {cancelModalOpen && (
          <div className="modal-overlay" onClick={handleCancelClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>{t('common.cancelAppointment')}</h2>
              <p className="modal-subtitle">{t('common.cancelReasonPrompt')}</p>
              <textarea
                className="modal-textarea"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder={t('common.cancelReasonPlaceholder')}
                rows={4}
                disabled={canceling}
              />
              {cancelError && <div className="error-message">{cancelError}</div>}
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelClose}
                  disabled={canceling}
                >
                  {t('common.back')}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleCancelConfirm}
                  disabled={canceling || !cancellationReason.trim()}
                >
                  {canceling ? t('common.canceling') : t('common.confirmCancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
