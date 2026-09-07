import { createFileRoute } from '@tanstack/react-router'
import { json } from '@/lib/server/response'
import { verifySession } from '@/lib/auth/session'
import { getDb } from '@/lib/db/config'

async function getSession(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/session_token=([^;]+)/)
  const token = match?.[1]
  if (!token) return null
  return verifySession(token)
}

export const Route = createFileRoute('/api/metadata/entities/$id/fields')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ error: { message: 'Unauthorized' } }, { status: 401 })
          }

          // biome-ignore lint/suspicious/noExplicitAny: metadata tables not in main schema
          const db = getDb() as any
          const fields = await db
            .selectFrom('metadata_entity_field')
            .selectAll()
            .where('entity_header_id', '=', params.id)
            .orderBy('display_order', 'asc')
            .execute()

          return json({ success: true, data: fields })
        } catch (error) {
          console.error('[MetadataEntityFields GET] Error:', error)
          return json(
            { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
            { status: 500 }
          )
        }
      },
    },
  },
})
