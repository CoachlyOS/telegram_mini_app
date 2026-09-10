import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { apiService } from '../services/api'
import { UserProvider, useUser } from '../contexts/UserContext'
import { getQueryParam } from '../utils/urlParams'
import LoadingRoute from './loading/route'
import ErrorRoute from './error/route'
import RoleSelectionRoute from './role_selection/route'
import ClientRegistrationRoute from './client.registration/route'
import ProfessionalSignInRoute from './professional.signin/route'
import SuccessRoute from './success/route'
import ClientDashboardRoute from './_signedin_client.dashboard/route'
import ProfessionalsRoute from './_signedin_client.professionals/route'
import BookRoute from './_signedin_client.book/route'
import ClientAppointmentsRoute from './_signedin_client.appointments/route'
import ClientInvitesRoute from './_signedin_client.invites/route'
import ClientPreviousAppointmentsRoute from './_signedin_client.previous-appointments/route'
import ClientPackagesRoute from './_signedin_client.packages/route'
import ProfessionalDashboardRoute from './_signedin_professional.dashboard/route'
import ProfessionalAppointmentsRoute from './_signedin_professional.appointments/route'
import SetUnavailableRoute from './_signedin_professional.set-unavailable/route'
import CreateGroupVisitRoute from './_signedin_professional.create-group-visit/route'
import TimetableRoute from './_signedin_professional.timetable.$date/route'
import SelectClientRoute from './_signedin_professional.previous-appointments.select-client/route'
import PreviousAppointmentsRoute from './_signedin_professional.previous-appointments/route'
import PackagesRoute from './_signedin_professional.packages/route'
import ProfessionalProfileRoute from './_signedin_professional.profile/route'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        expand: () => void
        enableClosingConfirmation: () => void
        BackButton: {
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
        HapticFeedback: {
          notificationOccurred: (type: string) => void
        }
        showAlert: (message: string) => void
      }
    }
  }
}

function AppRouterContent() {
  const { t, i18n } = useTranslation()
  const { chatID, initialized } = useTelegram()
  const { user, setUser } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Read appointment_id and invite_id from query parameters
  const appointmentID = getQueryParam('appointment_id')
  const inviteID = getQueryParam('invite_id')

  // Fetch user on mount (only once)
  useEffect(() => {
    if (!initialized || !chatID) {
      setIsLoading(false)
      return
    }

    // If user already loaded, check if we need to navigate to appointments with appointment_id or invites with invite_id
    if (user !== null) {
      setIsLoading(false)
      // If user is professional and appointment_id is in query, navigate to appointments
      if (user.role === 'professional' && appointmentID) {
        navigate('/professional/appointments', { 
          replace: true,
          state: { appointmentID }
        })
      }
      // If user is client and invite_id is in query, navigate to invites
      else if (user.role === 'client' && inviteID) {
        navigate('/client/invites', { 
          replace: true,
          state: { inviteID }
        })
      }
      return
    }

    // Don't fetch if we're already on registration/auth pages
    const authRoutes = ['/role-selection', '/client/register', '/professional/signin', '/loading', '/error', '/success']
    if (authRoutes.includes(location.pathname)) {
      setIsLoading(false)
      return
    }

    const fetchUser = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const userData = await apiService.getUserByChatID(chatID, i18n.language || 'en')
        if (userData && userData.user) {
          setUser(userData.user)
          // Set token in API service for authenticated requests
          if (userData.user.token) {
            apiService.setToken(userData.user.token)
          }
          // Update i18n language if locale is provided in user data
          if (userData.user.locale && userData.user.locale !== i18n.language) {
            i18n.changeLanguage(userData.user.locale)
          }
          // Redirect based on role
          if (userData.user.role === 'client') {
            // If invite_id is in query params, navigate to invites with it
            if (inviteID) {
              navigate('/client/invites', { 
                replace: true,
                state: { inviteID }
              })
            } else {
              navigate('/client/dashboard', { replace: true })
            }
          } else if (userData.user.role === 'professional') {
            // If appointment_id is in query params, navigate to appointments with it
            if (appointmentID) {
              navigate('/professional/appointments', { 
                replace: true,
                state: { appointmentID }
              })
            } else {
              navigate('/professional/dashboard', { replace: true })
            }
          } else {
            navigate('/success', { replace: true })
          }
        } else {
          navigate('/role-selection', { replace: true })
        }
      } catch (err) {
        // 404 is expected when user doesn't exist - redirect to role selection
        if (err.message?.includes('404') || err.message?.includes('not found')) {
          navigate('/role-selection', { replace: true })
        } else {
          const apiUrl = apiService.baseURL || 'Not configured'
          setError(t('error.userCheckError', { apiUrl }))
          navigate('/error', { replace: true })
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [initialized, chatID, navigate, setUser, user, location.pathname, appointmentID, inviteID])

  // Setup Telegram Back Button
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) return

    const hideRoutes = ['/role-selection', '/client/dashboard', '/professional/dashboard', '/loading', '/success', '/error', '/']
    const shouldHide = hideRoutes.includes(location.pathname)

    if (shouldHide) {
      tg.BackButton.hide()
      return
    }

    tg.BackButton.show()
    const handleBack = () => {
      if (location.pathname === '/professional/appointments') {
        navigate('/professional/dashboard', { replace: false })
      } else if (location.pathname === '/client/invites') {
        navigate('/client/dashboard', { replace: false })
      } else {
        navigate(-1)
      }
    }
    tg.BackButton.onClick(handleBack)

    return () => {
      tg.BackButton.offClick(handleBack)
    }
  }, [location.pathname, location.search, navigate])

  // Show loading only if we're on loading route or initializing
  if (isLoading && (location.pathname === '/loading' || location.pathname === '/')) {
    return <LoadingRoute />
  }

  return (
    <Routes>
      <Route path="/loading" element={<LoadingRoute />} />
      <Route path="/error" element={<ErrorRoute error={error} />} />
      <Route path="/role-selection" element={<RoleSelectionRoute />} />
      <Route path="/client/register" element={<ClientRegistrationRoute />} />
      <Route path="/professional/signin" element={<ProfessionalSignInRoute />} />
      <Route path="/success" element={<SuccessRoute />} />
      
      {/* Client routes */}
      <Route path="/client/dashboard" element={<ClientDashboardRoute />} />
      <Route path="/client/professionals" element={<ProfessionalsRoute />} />
      <Route path="/client/book" element={<BookRoute />} />
      <Route path="/client/appointments" element={<ClientAppointmentsRoute />} />
      <Route path="/client/invites" element={<ClientInvitesRoute />} />
      <Route path="/client/previous-appointments" element={<ClientPreviousAppointmentsRoute />} />
      <Route path="/client/packages" element={<ClientPackagesRoute />} />
      
      {/* Professional routes */}
      <Route path="/professional/dashboard" element={<ProfessionalDashboardRoute />} />
      <Route path="/professional/appointments" element={<ProfessionalAppointmentsRoute />} />
      <Route path="/professional/set-unavailable" element={<SetUnavailableRoute />} />
      <Route path="/professional/create-group-visit" element={<CreateGroupVisitRoute />} />
      <Route path="/professional/timetable/:date" element={<TimetableRoute />} />
      <Route path="/professional/previous-appointments/select-client" element={<SelectClientRoute />} />
      <Route path="/professional/previous-appointments" element={<PreviousAppointmentsRoute />} />
      <Route path="/professional/packages" element={<PackagesRoute />} />
      <Route path="/professional/profile" element={<ProfessionalProfileRoute />} />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/loading" replace />} />
      <Route path="*" element={<Navigate to="/loading" replace />} />
    </Routes>
  )
}

export default function AppRouter() {
  return (
    <UserProvider>
      <AppRouterContent />
    </UserProvider>
  )
}
