import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../contexts/UserContext'
import { apiService } from '../../services/api'
import ProfessionalDashboard from './components/ProfessionalDashboard'

export default function ProfessionalDashboardRoute() {
  const navigate = useNavigate()
  const { user } = useUser()

  if (!user) return null

  const handleViewAppointments = () => {
    navigate('/professional/appointments')
  }

  const handleSetUnavailable = () => {
    navigate('/professional/set-unavailable')
  }

  const handleViewTimetable = () => {
    const today = new Date().toISOString().split('T')[0]
    navigate(`/professional/timetable/${today}`)
  }

  const handleViewPreviousAppointments = () => {
    navigate('/professional/previous-appointments')
  }

  const handleCreateGroupVisit = () => {
    navigate('/professional/create-group-visit')
  }

  const handleViewPackages = () => {
    navigate('/professional/packages')
  }

  const handleEditProfile = () => {
    navigate('/professional/profile')
  }

  const handleLocaleChange = async (locale: string) => {
    await apiService.updateProfessionalLocale(locale)
  }

  return (
    <ProfessionalDashboard
      user={user}
      onViewAppointments={handleViewAppointments}
      onSetUnavailable={handleSetUnavailable}
      onViewTimetable={handleViewTimetable}
      onViewPreviousAppointments={handleViewPreviousAppointments}
      onCreateGroupVisit={handleCreateGroupVisit}
      onViewPackages={handleViewPackages}
      onEditProfile={handleEditProfile}
      onLocaleChange={handleLocaleChange}
    />
  )
}
