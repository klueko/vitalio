/**
 * API Service for making authenticated requests to the backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/api/me/data')
 * @param {string} accessToken - Auth0 access token
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
export async function apiRequest(endpoint, accessToken, options = {}) {
  const url = `${API_URL}${endpoint}`
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `HTTP Error: ${response.status}`)
  }

  return response.json()
}

/**
 * Get patient data (requires authentication)
 * @param {string} accessToken - Auth0 access token
 * @returns {Promise<Object>} Patient data with device_id and measurements
 */
export async function getPatientData(accessToken) {
  return apiRequest('/api/me/data', accessToken, {
    method: 'GET',
  })
}
