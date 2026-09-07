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

export const Route = createFileRoute('/api/metadata/entities')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ error: { message: 'Unauthorized' } }, { status: 401 })
          }

          const url = new URL(request.url)
          const dataSourceId = url.searchParams.get('data_source_id')
          const includeHidden = url.searchParams.get('include_hidden') === 'true'
          const isActive = url.searchParams.get('is_active') !== 'false'

          if (!dataSourceId) {
            return json({ error: { message: 'data_source_id is required' } }, { status: 400 })
          }

          const result = await EntityService.list({
            data_source_id: dataSourceId,
            include_hidden: includeHidden,
          })

          return json({
            data: {
              entities: result.entities,
              total: result.total,
            },
          })
        } catch (error) {
          console.error('[MetadataEntities API] Error:', error)
          return json(
            {
              error: {
                message: error instanceof Error ? error.message : 'Failed to fetch entities',
              },
            },
            { status: 500 }
          )
        }
      },
    },
  },
})
