'use client'

import Pusher from 'pusher-js'

let client: Pusher | null = null

export function getPusherClient(): Pusher {
  if (!client) {
    client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    })
  }
  return client
}

export function destroyPusherClient(): void {
  client?.disconnect()
  client = null
}
