import type { Services } from './contracts'

const backend = import.meta.env.VITE_BACKEND || 'supabase'

let servicesModule: { createServices: () => Services }

if (backend === 'rest') {
  servicesModule = await import('./rest')
} else {
  servicesModule = await import('./supabase')
}

export const services: Services = servicesModule.createServices()