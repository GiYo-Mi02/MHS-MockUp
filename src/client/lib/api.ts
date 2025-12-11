import axios from 'axios'

// In Vercel deployment, API routes are served from /api
// In development, we use the same origin so /api works
export const API_URL = '/api'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})
