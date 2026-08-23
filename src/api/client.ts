import axios from 'axios'

// Vite exposes VITE_* env vars on import.meta.env (typed via vite/client).
const API_PREFIX: string | undefined = import.meta.env.VITE_AIRFLOW_API_PREFIX

export const api = axios.create({
  baseURL: API_PREFIX || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
