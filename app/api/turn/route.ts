import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.METERED_API_KEY
  const appUrl = process.env.METERED_APP_URL

  if (!apiKey || !appUrl) {
    return NextResponse.json({ error: 'TURN not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://${appUrl}/api/v1/turn/credentials?apiKey=${apiKey}`,
    { next: { revalidate: 3600 } }, // cache credentials for 1 hour
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch TURN credentials' }, { status: 502 })
  }

  const iceServers = await res.json()
  return NextResponse.json(iceServers)
}
