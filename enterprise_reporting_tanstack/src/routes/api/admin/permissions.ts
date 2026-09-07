import { createFileRoute } from '@tanstack/react-router'
import { json } from '@/lib/server/response'
import { verifySession } from '@/lib/auth/session'
import { getDb } from '@/lib/db/config'
import { randomUUID } from 'node:crypto'

async function getSession(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/session_token=([^;]+)/)
  const token = match?.[1]
  if (!token) return null
  return verifySession(token)
}

export const Route = createFileRoute('/api/admin/permissions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ success: false, error: { message: 'Not authenticated' } }, { status: 401 })
          }

          const db = getDb()
          const permissions = await db
            .selectFrom('resource_permissions as rp')
            .leftJoin('roles as r', 'r.id', 'rp.role_id')
            .select([
              'rp.id',
              'rp.resource_type',
              'rp.resource_id',
              'rp.role_id',
              'r.name as role_name',
              'rp.permission_level',
              'rp.created_at',
            ])
            .orderBy('rp.created_at', 'desc')
            .execute()

          return json({ success: true, data: permissions })
        } catch (error) {
          console.error('Error fetching permissions:', error)
          return json({ success: false, error: { message: 'Failed to fetch permissions' } }, { status: 500 })
        }
      },

      POST: async ({ request }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ success: false, error: { message: 'Not authenticated' } }, { status: 401 })
          }

          const body = (await request.json()) as {
            resourceType?: string
            resourceId?: string
            roleId?: string
            permissionLevel?: string
          }

          if (!body.resourceType || !body.resourceId || !body.roleId || !body.permissionLevel) {
            return json(
              { success: false, error: { message: 'resourceType, resourceId, roleId, and permissionLevel are required' } },
              { status: 400 }
            )
          }

          const db = getDb()
          const id = randomUUID()
          await db
            .insertInto('resource_permissions')
            .values({
              id,
              resource_type: body.resourceType,
              resource_id: body.resourceId,
              role_id: body.roleId,
              permission_level: body.permissionLevel,
              created_at: new Date().toISOString(),
            })
            .execute()

          return json({ success: true, data: { id } })
        } catch (error) {
          console.error('Error creating permission:', error)
          return json({ success: false, error: { message: 'Failed to create permission' } }, { status: 500 })
        }
      },

      DELETE: async ({ request }) => {
        try {
          const session = await getSession(request)
          if (!session?.user) {
            return json({ success: false, error: { message: 'Not authenticated' } }, { status: 401 })
          }

          const body = (await request.json()) as { id?: string }
          if (!body.id) {
            return json({ success: false, error: { message: 'id is required' } }, { status: 400 })
          }

          const db = getDb()
          await db.deleteFrom('resource_permissions').where('id', '=', body.id).execute()

          return json({ success: true })
        } catch (error) {
          console.error('Error deleting permission:', error)
          return json({ success: false, error: { message: 'Failed to delete permission' } }, { status: 500 })
        }
      },
    },
  },
})
