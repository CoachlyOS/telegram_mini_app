// API service for booking API integration
// Используем относительный путь - Vite прокси перенаправит на booking_api
// If VITE_API_BASE_URL is set, use it; otherwise use relative path for Vite proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api' // Use relative path to leverage Vite proxy

// Log API URL for debugging (only in development or if explicitly enabled)
if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API_URL) {
  console.log('API Base URL:', API_BASE_URL)
  console.log('VITE_API_BASE_URL env:', import.meta.env.VITE_API_BASE_URL || 'not set')
}

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL
    this.token = null
  }

  setToken(token) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add Authorization header if token is available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const config = {
      ...options,
      headers,
    }

    try {
      const response = await fetch(url, config)
      
      // Check if response has content before trying to parse JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`)
      }

      const data = await response.json()

      if (!response.ok) {
        const error = new Error(data.message || `HTTP error! status: ${response.status}`)
        error.status = response.status
        error.data = data
        throw error
      }

      return data
    } catch (error) {
      // Improve error logging
      const errorMessage = error.message || String(error)
      
      // Check for network/CORS errors
      if (
        error instanceof TypeError || 
        errorMessage.includes('fetch') || 
        errorMessage.includes('Load failed') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')
      ) {
        // Network error or CORS issue
        const apiBaseInfo = {
          VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'not set',
          baseURL: this.baseURL,
          constructedURL: url,
          usingProxy: !import.meta.env.VITE_API_BASE_URL
        }
        
        console.error('Network/CORS error detected:', {
          url,
          error: errorMessage,
          errorType: error.constructor.name,
          apiConfig: apiBaseInfo,
          stack: error.stack
        })
        
        // Provide helpful error message
        const proxyHint = apiBaseInfo.usingProxy 
          ? '\nNote: Using Vite proxy (relative path). Make sure Vite dev server is running on port 8000.'
          : '\nNote: Using direct API URL. Make sure the API server is running and accessible.'
        
        const helpfulMessage = `Cannot connect to API at ${url}. ` +
          `Possible causes:\n` +
          `1. Server is not running (check http://localhost:8080/health)\n` +
          `2. CORS is not configured correctly (server needs restart after CORS changes)\n` +
          `3. Network connectivity issue\n` +
          `4. Vite proxy not working (if using relative paths)${proxyHint}\n\n` +
          `API Config: ${JSON.stringify(apiBaseInfo, null, 2)}\n` +
          `Original error: ${errorMessage}`
        
        throw new Error(helpfulMessage)
      }
      
      // Re-throw with better context for other errors
      console.error('API request failed:', {
        url,
        method: options.method || 'GET',
        error: errorMessage,
        errorType: error.constructor.name,
        stack: error.stack
      })
      throw error
    }
  }

  // Check if user exists by chat_id
  async getUserByChatID(chatID, locale = 'en') {
    return this.request(`/users/${chatID}?locale=${locale}`)
  }

  // Register client
  async registerClient(clientData) {
    return this.request('/clients/register', {
      method: 'POST',
      body: JSON.stringify(clientData),
    })
  }

  // Professional sign in
  async signInProfessional(professionalData) {
    return this.request('/professionals/sign_in', {
      method: 'POST',
      body: JSON.stringify(professionalData),
    })
  }

  // Get professionals with pagination (excluding subscribed ones)
  async getProfessionals(page = 1, pageSize = 15) {
    return this.request(`/clients/professionals/all?page=${page}&pageSize=${pageSize}`)
  }

  // Get professional availability
  async getProfessionalAvailability(professionalID, date) {
    return this.request(`/professionals/${professionalID}/availability?date=${date}`)
  }

  // Create appointment
  async createAppointment(appointmentData) {
    return this.request('/clients/book_appointment', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    })
  }

  // Get professional appointments
  async getProfessionalAppointments(status = '', page = 1, pageSize = 15) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    return this.request(`/professionals/appointments?${params.toString()}`)
  }

  // Get client appointments
  async getClientAppointments(status = '', page = 1, pageSize = 15) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    return this.request(`/clients/appointments?${params.toString()}`)
  }

  // Get client previous appointments
  async getClientPreviousAppointments(page = 1, pageSize = 15) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    return this.request(`/clients/previous_appointments?${params.toString()}`)
  }

  // Cancel client appointment
  async cancelClientAppointment(appointmentID, cancellationReason) {
    return this.request(`/clients/appointments/${appointmentID}`, {
      method: 'DELETE',
      body: JSON.stringify({
        cancellation_reason: cancellationReason,
      }),
    })
  }


  // Confirm professional appointment
  async confirmProfessionalAppointment(appointmentID) {
    return this.request(`/professionals/appointments/${appointmentID}/confirm`, {
      method: 'PATCH',
    })
  }

  // Cancel professional appointment
  async cancelProfessionalAppointment(appointmentID, cancellationReason) {
    return this.request(`/professionals/appointments/${appointmentID}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({
        cancellation_reason: cancellationReason,
      }),
    })
  }

  // Get appointment details
  async getAppointmentDetails(appointmentID) {
    return this.request(`/professionals/appointments/${appointmentID}`)
  }

  // Create unavailable appointment
  async createUnavailableAppointment(appointmentData) {
    return this.request(`/professionals/unavailable_appointments`, {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    })
  }

  // Create group visit appointment
  async createGroupVisitAppointment(appointmentData) {
    return this.request(`/professionals/group_visit_appointments`, {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    })
  }

  // Get professional timetable
  async getProfessionalTimetable(date) {
    return this.request(`/professionals/timetable?date=${date}`)
  }

  // Get professional timetable from client perspective
  async getProfessionalsTimetable(professionalID, date) {
    return this.request(`/clients/professionals/${professionalID}/timetable?date=${date}`)
  }

  // Get professional clients
  async getProfessionalClients(professionalID) {
    return this.request(`/professionals/${professionalID}/clients`)
  }

  // Get previous appointments with optional client filter, date range, and pagination
  async getPreviousAppointments(clientID = null, page = 1, pageSize = 15, dateFrom = null, dateTo = null) {
    const params = new URLSearchParams()
    if (clientID) {
      params.append('client_id', clientID)
    }
    if (dateFrom) {
      params.append('date_from', dateFrom)
    }
    if (dateTo) {
      params.append('date_to', dateTo)
    }
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    return this.request(`/professionals/previous_appointments?${params.toString()}`)
  }

  // Update client locale
  async updateClientLocale(locale) {
    return this.request('/clients/update_locale', {
      method: 'PATCH',
      body: JSON.stringify({ locale }),
    })
  }

  // Update professional locale
  async updateProfessionalLocale(locale) {
    return this.request('/professionals/update_locale', {
      method: 'PATCH',
      body: JSON.stringify({ locale }),
    })
  }

  // Subscribe to professional
  async subscribeToProfessional(professionalID, chatID, locale) {
    return this.request(`/clients/subscribe`, {
      method: 'POST',
      body: JSON.stringify({
        professional_id: professionalID,
        chat_id: chatID,
        locale: locale,
      }),
    })
  }

  // Unsubscribe from professional
  async unsubscribeFromProfessional(professionalID) {
    return this.request(`/clients/unsubscribe/${professionalID}`, {
      method: 'DELETE',
    })
  }

  // Get subscribed professionals with pagination
  async getSubscribedProfessionals(page = 1, pageSize = 15) {
    return this.request(`/clients/professionals?page=${page}&pageSize=${pageSize}`)
  }

  // Get professional subscriptions
  async getProfessionalSubscriptions() {
    return this.request(`/professionals/subscriptions`)
  }

  // Get professional profile preferences
  async getProfessionalProfile() {
    return this.request('/professionals/profile')
  }

  // Update professional profile preferences
  async updateProfessionalProfile(profileData) {
    return this.request('/professionals/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    })
  }

  // Get client invites
  async getClientInvites() {
    return this.request(`/clients/invites`)
  }

  // Get client invite by ID
  async getClientInvite(inviteID) {
    return this.request(`/clients/invites/${inviteID}`)
  }

  // Delete client invite
  async deleteClientInvite(inviteID) {
    return this.request(`/clients/invites/${inviteID}`, {
      method: 'DELETE',
    })
  }

  // Get missing invite users for a confirmed appointment
  async getMissingInviteUsers(appointmentID) {
    return this.request(`/professionals/appointments/${appointmentID}/missing_invite_users`)
  }

  // Get pending invite users for an appointment (users who haven't confirmed yet)
  async getPendingInviteUsers(appointmentID) {
    return this.request(`/professionals/appointments/${appointmentID}/pending_invite_users`)
  }

  // Update a confirmed appointment (description, type only)
  async updateAppointment(appointmentID, data) {
    return this.request(`/professionals/appointments/${appointmentID}/update`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Send invites for an appointment to selected clients
  async createInviteForAppointment(appointmentID, clients) {
    return this.request(`/professionals/appointments/${appointmentID}/invite`, {
      method: 'POST',
      body: JSON.stringify({ client: clients }),
    })
  }

  // Get missing clients for a previous appointment
  async getMissingClientsForPreviousAppointment(appointmentID) {
    return this.request(`/professionals/previous_appointments/${appointmentID}/missing_clients`)
  }

  // Update a previous appointment (add/remove clients)
  async updatePreviousAppointment(appointmentID, data) {
    return this.request(`/professionals/previous_appointments/${appointmentID}/update`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Get list of packages for professional
  async getPackages() {
    return this.request('/professionals/packages')
  }

  // Create a new package
  async createPackage(data) {
    return this.request('/professionals/packages', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Get package details
  async getPackageDetails(packageId) {
    return this.request(`/professionals/packages/${packageId}`)
  }

  // Accept client invite
  async acceptClientInvite(inviteID, appointmentID, type) {
    return this.request(`/clients/invites/${inviteID}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        appointment_id: appointmentID,
        type: type,
      }),
    })
  }

  // Get client packages
  async getClientPackages() {
    return this.request('/clients/packages')
  }

  // Get client package details
  async getClientPackageDetails(packageID) {
    return this.request(`/clients/packages/${packageID}`)
  }
}

export const apiService = new ApiService()
