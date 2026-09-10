import { useState, useEffect, useCallback } from 'react'
import { apiService } from '../../../services/api'
import i18n from '../../../i18n/config.js'
import { formatDateLocal } from '../../../utils/date'
import { useClients, Client } from '../../../hooks/professionals/useClients'

export interface AvailabilitySlot {
  start_time: string
  end_time: string
  available: boolean
}

export interface CreateGroupVisitClient {
  id: string
  chat_id: number
  locale: string
}

interface UseGroupVisitResult {
  selectedDate: string | null
  setSelectedDate: (date: string | null) => void
  availableSlots: AvailabilitySlot[]
  slotsLoading: boolean
  slotsError: string | null
  selectedSlot: AvailabilitySlot | null
  setSelectedSlot: (slot: AvailabilitySlot | null) => void
  type: 'split' | 'group'
  setType: (type: 'split' | 'group') => void
  clients: Client[]
  clientsLoading: boolean
  clientsError: string | null
  selectedClients: Set<string>
  setSelectedClients: (clients: Set<string>) => void
  handleClientChange: (clientId: string, checked: boolean, type: 'split' | 'group') => void
  searchClients: (query: string) => Client[]
  description: string
  setDescription: (desc: string) => void
  createGroupVisit: (onSuccess: () => void) => Promise<void>
  creating: boolean
  error: string | null
}

export function useGroupVisit(professionalID: string): UseGroupVisitResult {
  const [selectedDate, setSelectedDateState] = useState<string | null>(formatDateLocal(new Date()))

  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlotState] = useState<AvailabilitySlot | null>(null)

  const [type, setType] = useState<'split' | 'group'>('group')

  // Full client list replaces the old subscription roster. Backend removed
  // "invite all", so selection is always explicit; the picker filters in-memory.
  const { clients, loading: clientsLoading, error: clientsError, searchClients } = useClients()

  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())

  const [description, setDescription] = useState('')

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSelectedDate = useCallback((date: string | null) => {
    setSelectedDateState(date)
    setSelectedSlotState(null)
    setError(null)
  }, [])

  const setSelectedSlot = useCallback((slot: AvailabilitySlot | null) => {
    setSelectedSlotState(slot)
    setError(null)
  }, [])

  // Load slots when date changes
  useEffect(() => {
    if (!professionalID || !selectedDate) {
      setAvailableSlots([])
      return
    }

    const load = async () => {
      setSlotsLoading(true)
      setSlotsError(null)
      try {
        const data = await apiService.getProfessionalAvailability(professionalID, selectedDate) as { slots: AvailabilitySlot[] }
        const available = data.slots?.filter((slot) => slot.available) || []
        setAvailableSlots(available)
      } catch (err: any) {
        setSlotsError(err.message || i18n.t('error.loadAvailabilityFailed'))
        setAvailableSlots([])
      } finally {
        setSlotsLoading(false)
      }
    }
    load()
  }, [professionalID, selectedDate])

  const handleClientChange = useCallback((clientId: string, checked: boolean, type: 'split' | 'group') => {
    if (checked) {
      // For split type, only allow 2 clients max
      if (type === 'split') {
        setSelectedClients(prev => {
          if (prev.size >= 2) {
            return prev // Don't add if already at limit
          }
          const newSet = new Set(prev)
          newSet.add(clientId)
          return newSet
        })
      } else {
        setSelectedClients(prev => {
          const newSet = new Set(prev)
          newSet.add(clientId)
          return newSet
        })
      }
    } else {
      setSelectedClients(prev => {
        const newSet = new Set(prev)
        newSet.delete(clientId)
        return newSet
      })
    }
  }, [])

  const createGroupVisit = useCallback(async (onSuccess: () => void) => {
    if (!selectedSlot || !description.trim()) return

    const validClients = clients.filter(s => s.chat_id !== null)

    // Backend removed "invite all"; always send an explicit client list with
    // clients_selected: 'partially_selected'.
    const clientsPayload: CreateGroupVisitClient[] = Array.from(selectedClients)
      .map(id => {
        const client = validClients.find(s => s.id === id)
        if (!client || client.chat_id === null || client.chat_id === undefined) return null
        if (!client.locale || client.locale.trim() === '') return null
        return {
          id: client.id,
          chat_id: client.chat_id,
          locale: client.locale,
        }
      })
      .filter((client): client is CreateGroupVisitClient => client !== null)

    setCreating(true)
    setError(null)

    try {
      await apiService.createGroupVisitAppointment({
        start_at: selectedSlot.start_time,
        end_at: selectedSlot.end_time,
        description: description.trim(),
        type,
        clients_selected: 'partially_selected',
        clients: clientsPayload,
      })

      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.HapticFeedback.notificationOccurred('success')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || i18n.t('error.createGroupVisitFailed'))
    } finally {
      setCreating(false)
    }
  }, [selectedSlot, description, type, selectedClients, clients])

  return {
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
  }
}
