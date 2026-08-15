import React from 'react'
import { useTranslation } from 'react-i18next'
import { Routes } from '../../../constants'

interface SuccessProps {
  user: any
  onNavigate: (route: string) => void
}

export default function Success({ user, onNavigate }: SuccessProps) {
  const { t } = useTranslation()

  // If user is client, navigate to dashboard
  React.useEffect(() => {
    if (user?.role === 'client') {
      onNavigate('/client/dashboard')
    }
  }, [user, onNavigate])

  return (
    <div className="container">
      <div className="success-screen">
        <h1>{t('success.title')}</h1>
        {user && (
          <div className="user-info">
            <p>{t('success.welcome', { name: `${user.first_name} ${user.last_name}`.trim() })}</p>
            <p>
              {t('success.role', {
                role: t(`common.roles.${user.role}`, user.role),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
