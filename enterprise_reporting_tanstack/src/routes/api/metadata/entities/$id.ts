import { createFileRoute } from '@tanstack/react-router'
import { json } from '@/lib/server/response'
import { verifySession } from '@/lib/auth/session'
import { EntityService } from '@/lib/metadata/entity-service'

async function getSession(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/session_token=([^;]+)/)
  const token = match?.[1]
  if (!token) return null
  return verifySession(token)
}

export const Route = createFileRoute('/api/metadata/entities/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ error: { message: 'Unauthorized' } }, { status: 401 })
          }

          const entity = await EntityService.getById(params.id)
          if (!entity) {
            return json({ error: { message: 'Entity not found' } }, { status: 404 })
          }

          return json({ success: true, data: entity })
        } catch (error) {
          console.error('[MetadataEntity GET] Error:', error)
          return json(
            { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
            { status: 500 }
          )
        }
      },

      PUT: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ error: { message: 'Unauthorized' } }, { status: 401 })
          }

          const body = await request.json()
          const { description, is_active, is_hidden } = body

          const updated = await EntityService.update(
            params.id,
            { description, is_active, is_hidden },
            session.user.id
          )

          if (!updated) {
            return json({ error: { message: 'Entity not found' } }, { status: 404 })
          }

          return json({ success: true, data: updated })
        } catch (error) {
          console.error('[MetadataEntity PUT] Error:', error)
          return json(
            { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
            { status: 500 }
          )
        }
      },

      DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ error: { message: 'Unauthorized' } }, { status: 401 })
          }

          const deleted = await EntityService.delete(params.id, session.user.id)
          if (!deleted) {
            return json({ error: { message: 'Entity not found' } }, { status: 404 })
          }

          return json({ success: true })
        } catch (error) {
          console.error('[MetadataEntity DELETE] Error:', error)
          return json(
            { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
            { status: 500 }
          )
        }
      },
    },
  },
})
