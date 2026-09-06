import type { Services } from './contracts'

const servicesModule = await import('./neon')

export const services: Services = servicesModule.createServices()