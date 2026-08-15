import React from 'react'
import { useUser } from '../../contexts/UserContext'
import ProfessionalProfile from './components/ProfessionalProfile'

export default function ProfessionalDashboardRoute() {
  const { user } = useUser()

  if (!user) return null

  return (
    <ProfessionalProfile user={user}/>
  )
}
