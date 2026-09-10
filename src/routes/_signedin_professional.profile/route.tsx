import React from 'react'
import { useUser } from '../../contexts/UserContext'
import EditProfile from './components/EditProfile'

export default function ProfessionalProfileRoute() {
  const { user } = useUser()

  if (!user) return null

  return <EditProfile professionalID={user.id} />
}
