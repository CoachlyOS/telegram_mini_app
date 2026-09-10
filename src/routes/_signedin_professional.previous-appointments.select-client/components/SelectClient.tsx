import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClients } from '../../../hooks/professionals/useClients'
import './SelectClient.css'

interface SelectClientProps {
  professionalID: string
  onSelect: (clientID: string | null, clientName: string) => void
  onCancel: () => void
}

export default function SelectClient({ professionalID, onSelect, onCancel }: SelectClientProps) {
  const { t } = useTranslation()
  const { clients, loading, error, refetch, searchClients } = useClients()
  const [clientSearch, setClientSearch] = useState('')

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="loading">{t('professional.previousAppointments.selectClient.loading')}</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-screen">
          <div className="error-message">{error}</div>
          <button className="btn btn-primary" onClick={refetch}>
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  const filteredClients = searchClients(clientSearch)

  return (
    <div className="container">
      <header className="header">
        <h1>👥 {t('professional.previousAppointments.selectClient.title')}</h1>
        <p className="subtitle">{t('professional.previousAppointments.selectClient.subtitle')}</p>
      </header>
      <div className="content">
        <div className="clients-search">
          <input
            type="text"
            className="client-search-input"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder={t('professional.previousAppointments.selectClient.searchClients')}
          />
        </div>
        <div className="clients-list">
          <button
            className="client-button"
            onClick={() => onSelect(null, t('professional.previousAppointments.selectClient.allClients'))}
          >
            <div className="client-name">
              {t('professional.previousAppointments.selectClient.allClients')}
            </div>
          </button>
          {filteredClients.length === 0 ? (
            <div className="empty-state">
              <p>{t('common.noClients')}</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <button
                key={client.id}
                className="client-button"
                onClick={() => onSelect(client.id, `${client.first_name} ${client.last_name}`)}
              >
                <div className="client-name">
                  {client.first_name} {client.last_name}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {t('common.backToDashboard')}
          </button>
        </div>
      </div>
    </div>
  )
}
