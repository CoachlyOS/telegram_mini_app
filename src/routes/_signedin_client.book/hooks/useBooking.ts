import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../../services/api'
import i18n from '../../../i18n/config.js'
import { formatDateLocal } from '../../../utils/date'
import { GetProfessionalsResponse } from '../../_signedin_client.professionals/hooks/useProfessionals'

export interface SubscribedProfessional {
  id: string
  first_name: string
  last_name: string
  chat_id?: number | null
  locale: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
  available: boolean
}

interface UseBookingResult {
  coaches: SubscribedProfessional[]
  coachesLoading: boolean
  availableSlots: TimeSlot[]
  slotsLoading: boolean
  slotsError: string | null
  createBooking: (onSuccess: () => void) => Promise<void>
  creating: boolean
  bookingError: string | null
  selectedCoach: SubscribedProfessional | null
  setSelectedCoach: (coach: SubscribedProfessional | null) => void
  selectedDate: string | null
  setSelectedDate: (date: string | null) => void
  selectedSlot: TimeSlot | null
  setSelectedSlot: (slot: TimeSlot | null) => void
}

export function useBooking(): UseBookingResult {
  const [coaches, setCoaches] = useState<SubscribedProfessional[]>([])
  const [coachesLoading, setCoachesLoading] = useState(true)

  const [selectedCoach, setSelectedCoachState] = useState<SubscribedProfessional | null>(null)
  const [selectedDate, setSelectedDateState] = useState<string | null>(formatDateLocal(new Date()))
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Load all coaches on mount. Subscriptions were removed, so the coach list now
  // comes from GET /clients/professionals/all (paginated). Page through every page
  // so the booking dropdown isn't silently truncated for clients with many coaches.
  useEffect(() => {
    const load = async () => {
      setCoachesLoading(true)
      try {
        const all: SubscribedProfessional[] = []
        let page = 1
        const pageSize = 50
        const maxPages = 100 // safety cap against an unexpected runaway loop
        while (page <= maxPages) {
          const data = await apiService.getProfessionals(page, pageSize) as GetProfessionalsResponse
          all.push(...(data.professionals || []))
          if (!data.pagination?.has_next_page) break
          page += 1
        }
        setCoaches(all)
      } catch {
        setCoaches([])
      } finally {
        setCoachesLoading(false)
      }
    }
    load()
  }, [])

  // Clear slot when coach or date changes
  const setSelectedCoach = useCallback((coach: SubscribedProfessional | null) => {
    setSelectedCoachState(coach)
    setSelectedSlot(null)
    setBookingError(null)
  }, [])

  const setSelectedDate = useCallback((date: string | null) => {
    setSelectedDateState(date)
    setSelectedSlot(null)
    setBookingError(null)
  }, [])

  // Load available slots when coach + date are both set
  useEffect(() => {
    if (!selectedCoach || !selectedDate) {
      setAvailableSlots([])
      return
    }

    const load = async () => {
      setSlotsLoading(true)
      setSlotsError(null)
      try {
        const data = await apiService.getProfessionalAvailability(selectedCoach.id, selectedDate)
        const available = data.slots?.filter((slot: TimeSlot) => slot.available) || []
        setAvailableSlots(available)
      } catch {
        setSlotsError(i18n.t('error.loadAvailabilityFailed'))
        setAvailableSlots([])
      } finally {
        setSlotsLoading(false)
      }
    }
    load()
  }, [selectedCoach, selectedDate])

  const createBooking = useCallback(async (onSuccess: () => void) => {
    if (!selectedCoach || !selectedSlot) return

    setCreating(true)
    setBookingError(null)
    try {
      await apiService.createAppointment({
        professional_id: selectedCoach.id,
        professional_chat_id: selectedCoach.chat_id!,
        professional_locale: selectedCoach.locale,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      })

      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.HapticFeedback.notificationOccurred('success')
      }

      onSuccess()
    } catch (err: any) {
      setBookingError(err.message || i18n.t('error.createAppointmentFailed'))
    } finally {
      setCreating(false)
    }
  }, [selectedCoach, selectedSlot])

  return {
    coaches,
    coachesLoading,
    availableSlots,
    slotsLoading,
    slotsError,
    createBooking,
    creating,
    bookingError,
    selectedCoach,
    setSelectedCoach,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
  }
}
