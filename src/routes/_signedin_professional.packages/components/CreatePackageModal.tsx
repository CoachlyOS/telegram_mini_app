import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle, User, Calendar, Hash, Search } from 'lucide-react'
import { useClients, Client } from '../../../hooks/professionals/useClients'

interface CreatePackageModalProps {
  professionalID: string
  onClose: () => void
  onSuccess: () => void
  createPackage: (data: any) => Promise<{ success: boolean; error?: string }>
}

export default function CreatePackageModal({
  professionalID,
  onClose,
  onSuccess,
  createPackage,
}: CreatePackageModalProps) {
  const { t } = useTranslation()

  const { clients, loading: clientsLoading, error: clientsError, searchClients } = useClients()
  const [clientSearch, setClientSearch] = useState('')

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [appointmentsNumber, setAppointmentsNumber] = useState<number>(1)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Set default dates
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    setIssuedAt(`${yyyy}-${mm}-${dd}`)

    // Default expiry: 1 month from now
    const expiry = new Date(today)
    expiry.setMonth(expiry.getMonth() + 1)
    const eYyyy = expiry.getFullYear()
    const eMm = String(expiry.getMonth() + 1).padStart(2, '0')
    const eDd = String(expiry.getDate()).padStart(2, '0')
    setExpiresAt(`${eYyyy}-${eMm}-${eDd}`)
  }, [])

  const handleSubmit = async () => {
    if (!selectedClient || !issuedAt || !expiresAt || appointmentsNumber < 1) return

    setCreating(true)
    setCreateError(null)

    const issuedAtDate = new Date(issuedAt)
    issuedAtDate.setHours(0, 0, 0, 0)
    const expiresAtDate = new Date(expiresAt)
    expiresAtDate.setHours(23, 59, 59, 999)

    const result = await createPackage({
      client: {
        id: selectedClient.id,
        chat_id: selectedClient.chat_id || 0,
        locale: selectedClient.locale || 'en',
      },
      professional_id: professionalID,
      issued_at: issuedAtDate.toISOString(),
      expires_at: expiresAtDate.toISOString(),
      apppointments_number: appointmentsNumber,
    })

    setCreating(false)

    if (result.success) {
      onSuccess()
    } else {
      setCreateError(result.error || t('error.createPackageFailed'))
    }
  }

  const isFormValid = selectedClient && issuedAt && expiresAt && appointmentsNumber >= 1

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
        <h2>{t('professional.packages.createPackage')}</h2>

        {/* Client selector */}
        <div className="form-group">
          <label className="form-label">
            <User size={16} />
            {t('professional.packages.selectClient')}
          </label>
          {clientsLoading ? (
            <div className="packages-status-inline">
              <Loader2 size={18} className="spinner" />
              <span>{t('common.loading')}</span>
            </div>
          ) : clientsError ? (
            <div className="packages-status-inline packages-error-inline">
              <AlertCircle size={18} />
              <span>{clientsError}</span>
            </div>
          ) : clients.length === 0 ? (
            <p className="no-data-text">{t('professional.packages.noClients')}</p>
          ) : (
            <div className="client-selector">
              <div className="client-search">
                <Search size={16} />
                <input
                  type="text"
                  className="client-search-input"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder={t('professional.packages.searchClients')}
                  disabled={creating}
                />
              </div>
              {searchClients(clientSearch).map((sub) => (
                <button
                  key={sub.id}
                  className={`client-option ${selectedClient?.id === sub.id ? 'selected' : ''}`}
                  onClick={() => setSelectedClient(sub)}
                  type="button"
                >
                  <div className="client-option-avatar">
                    {sub.first_name?.[0]}{sub.last_name?.[0]}
                  </div>
                  <span>{sub.first_name} {sub.last_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date fields */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <Calendar size={16} />
              {t('professional.packages.issuedAt')}
            </label>
            <input
              type="date"
              className="form-input"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <Calendar size={16} />
              {t('professional.packages.expiresAt')}
            </label>
            <input
              type="date"
              className="form-input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        {/* Appointments number */}
        <div className="form-group">
          <label className="form-label">
            <Hash size={16} />
            {t('professional.packages.appointmentsNumber')}
          </label>
          <input
            type="number"
            className="form-input"
            min={1}
            value={appointmentsNumber}
            onChange={(e) => setAppointmentsNumber(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        {/* Error message */}
        {createError && (
          <div className="create-package-error">
            <AlertCircle size={16} />
            <span>{createError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!isFormValid || creating}
          >
            {creating ? (
              <>
                <Loader2 size={16} className="spinner" />
                {t('common.creating')}
              </>
            ) : (
              <>
                {t('common.create')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
