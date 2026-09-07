/**
 * Give the administrator's assistant this application's model.
 *
 * The application ships with the `.eml.mmd` it was generated from, and the
 * backend embeds it at startup. This hook is the other end: a CopilotKit
 * action the model calls when it needs to know what the application actually
 * declares — which entities exist, what a rule decides, what a process does on
 * delete — rather than answering from what it remembers about ERDs in general.
 *
 * A search rather than a preloaded prompt for two reasons. The model is far
 * too large to send with every message, and making the lookup visible means an
 * administrator can see what the assistant consulted before acting on advice
 * about their production data.
 *
 */

import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../lib/api-client'

interface RetrievedChunk {
  kind: string
  name: string
  text: string
  score: number
}

interface SearchResponse {
  chunks: RetrievedChunk[]
  ready?: boolean
}

export function useModelAssistant() {
  const [ready, setReady] = useState<boolean | null>(null)

  // Embedding happens in the background at startup, so the assistant needs to
  // know whether the model is searchable yet — otherwise an empty result early
  // in the application's life reads as "this application declares nothing".
  useEffect(() => {
    let cancelled = false
    apiClient
      .get<{ ready: boolean }>('/model-context/status')
      .then((response) => {
        if (!cancelled) setReady(Boolean(response?.ready))
      })
      .catch(() => {
        if (!cancelled) setReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useCopilotReadable({
    description:
      "Whether this application's model has been indexed and can be searched with the " +
      'searchModel action.',
    value: { modelSearchable: ready },
    available: ready === null ? 'disabled' : 'enabled',
  })

  const search = useCallback(async ({ question }: { question: string }) => {
    try {
      const response = await apiClient.post<SearchResponse>('/model-context/search', {
        question,
        topK: 8,
      })

      if (!response?.chunks?.length) {
        return response?.ready === false
          ? "This application's model has not finished indexing yet. Say so rather than guessing."
          : 'Nothing in this application\'s model matches that. Say so rather than inventing an answer.'
      }

      return response.chunks
        .map((chunk) => `--- ${chunk.kind}: ${chunk.name} ---\n${chunk.text}`)
        .join('\n\n')
    } catch (error) {
      // Returned rather than thrown: the assistant can report that it could not
      // look something up and carry on, where a throw ends the turn.
      const message = error instanceof Error ? error.message : 'unknown error'
      return `The model search failed (${message}). Do not guess at the answer.`
    }
  }, [])

  useCopilotAction({
    name: 'searchModel',
    description:
      "Search this application's data model — its entities and their fields, the business " +
      'rules that run on them, and the multi-step processes that create, update and delete ' +
      'records. Use it before answering any question about how this application behaves, and ' +
      'before proposing a change to an entity, a rule or a workflow.',
    parameters: [
      {
        name: 'question',
        type: 'string',
        description:
          "What you need to know, in plain language — for example 'which processes write to " +
          "CAPA' or 'what happens when a stability test is deleted'.",
        required: true,
      },
    ],
    handler: search,
  })
}
