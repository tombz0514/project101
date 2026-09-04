import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res)
  })

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  // roomId -> Set of socket IDs
  const rooms = new Map<string, Set<string>>()

  io.on('connection', (socket) => {
    socket.on('join-room', (roomId: string) => {
      if (!rooms.has(roomId)) rooms.set(roomId, new Set())
      const room = rooms.get(roomId)!

      if (room.size >= 2) {
        socket.emit('room-full')
        return
      }

      room.add(socket.id)
      socket.join(roomId)
      socket.data.roomId = roomId

      const otherUsers = [...room].filter((id) => id !== socket.id)
      socket.emit('room-joined', { otherUsers })
      if (otherUsers.length > 0) {
        socket.to(roomId).emit('user-joined', socket.id)
      }
    })

    socket.on('offer', ({ to, offer }: { to: string; offer: unknown }) => {
      io.to(to).emit('offer', { from: socket.id, offer })
    })

    socket.on('answer', ({ to, answer }: { to: string; answer: unknown }) => {
      io.to(to).emit('answer', { from: socket.id, answer })
    })

    socket.on('ice-candidate', ({ to, candidate }: { to: string; candidate: unknown }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate })
    })

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId as string | undefined
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId)!
        room.delete(socket.id)
        if (room.size === 0) rooms.delete(roomId)
        socket.to(roomId).emit('user-left', socket.id)
      }
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
