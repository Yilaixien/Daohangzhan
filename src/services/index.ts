import type { Services } from './contracts'

const backend = import.meta.env.VITE_BACKEND || 'neon'

let servicesModule: { createServices: () => Services }

if (backend === 'rest') {
  servicesModule = await import('./rest')
} else {
  servicesModule = await import('./neon')
}

export const services: Services = servicesModule.createServices()