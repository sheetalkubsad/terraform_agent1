import { API_BASE } from './api-config';

export async function streamChat(
  payload: {
    session_id?: string
    message: string
  },
  onChunk: (data: any) => void
) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!response.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const events = chunk.split("\n\n")

    for (const event of events) {
      if (event.startsWith("data: ")) {
        try {
          const json = JSON.parse(event.replace("data: ", ""))
          onChunk(json)
        } catch {}
      }
    }
  }
}

export async function streamForm(
  payload: {
    session_id?: string
    // Batch mode
    _batch?: boolean
    resources?: any[]
    // Single update
    module_name?: string
    updates?: any
    // Single create
    resource_type?: string
    resource_name?: string
    attributes?: any
  },
  onChunk: (data: any) => void
) {
  const response = await fetch(`${API_BASE}/form`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!response.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const events = chunk.split("\n\n")

    for (const event of events) {
      if (event.startsWith("data: ")) {
        try {
          const json = JSON.parse(event.replace("data: ", ""))
          onChunk(json)
        } catch {}
      }
    }
  }
}