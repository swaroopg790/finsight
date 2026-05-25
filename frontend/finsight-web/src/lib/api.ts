import axios, { type AxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor — attach Bearer token ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('finsight_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor — silent token refresh on 401 ───────────────────
let isRefreshing    = false
let pendingQueue:   Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function drainQueue(token: string | null, error: unknown) {
  pendingQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)))
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as AxiosRequestConfig & { _retried?: boolean }

    // Only handle 401s that haven't already been retried
    if (err.response?.status !== 401 || original._retried) {
      return Promise.reject(err)
    }

    // Don't try to refresh if the failing request IS the refresh call
    if (original.url?.includes('/auth/refresh')) {
      clearTokens()
      window.location.href = '/login'
      return Promise.reject(err)
    }

    original._retried = true

    const refreshToken = localStorage.getItem('finsight_refresh_token')
    if (!refreshToken) {
      clearTokens()
      window.location.href = '/login'
      return Promise.reject(err)
    }

    // If a refresh is already in flight, queue this request behind it
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
            resolve(api(original))
          },
          reject,
        })
      })
    }

    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      )

      const newAccessToken  = data.token
      const newRefreshToken = data.refreshToken

      localStorage.setItem('finsight_token',         newAccessToken)
      localStorage.setItem('finsight_refresh_token', newRefreshToken)

      drainQueue(newAccessToken, null)
      original.headers = { ...original.headers, Authorization: `Bearer ${newAccessToken}` }
      return api(original)

    } catch (refreshErr) {
      drainQueue(null, refreshErr)
      clearTokens()
      window.location.href = '/login'
      return Promise.reject(refreshErr)

    } finally {
      isRefreshing = false
    }
  }
)

function clearTokens() {
  localStorage.removeItem('finsight_token')
  localStorage.removeItem('finsight_refresh_token')
}

export default api
