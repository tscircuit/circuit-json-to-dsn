/**
 * Freerouting API client for testing DSN to SES routing.
 *
 * Usage:
 *   const sesOutput = await routeDsnWithFreerouting(dsnString)
 */

import defaultKy from "ky"
import crypto from "node:crypto"

const FREEROUTING_API_BASE = "https://api.freerouting.app/v1"

interface SessionResponse {
  id: string
  user_id: string
  host: string
}

interface JobResponse {
  id: string
  session_id: string
  name: string
  state: string
  stage?: string
}

interface OutputResponse {
  job_id: string
  data: string
  size: number
  crc32: number
  format: string
  filename: string
  statistics?: {
    layer_count: number
    component_count: number
    routed_net_count: number
    unrouted_net_count: number
    via_count: number
  }
}

export interface FreeroutingOptions {
  /** API base URL (defaults to https://api.freerouting.app/v1) */
  baseUrl?: string
  /** Profile ID for authentication (defaults to random UUID) */
  profileId?: string
  /** Maximum time to wait for routing in ms (default: 5 minutes) */
  timeout?: number
  /** Polling interval in ms (default: 1000) */
  pollInterval?: number
}

/**
 * Routes a DSN string through the Freerouting API and returns the SES output.
 *
 * @param dsnString - The DSN file content as a string
 * @param options - Optional configuration
 * @returns The SES file content as a string
 */
export async function routeDsnWithFreerouting(
  dsnString: string,
  options: FreeroutingOptions = {},
): Promise<string> {
  const baseUrl = options.baseUrl ?? FREEROUTING_API_BASE
  const timeout = options.timeout ?? 5 * 60 * 1000 // 5 minutes
  const pollInterval = options.pollInterval ?? 1000
  const profileId = options.profileId ?? crypto.randomUUID()

  const ky = defaultKy.create({
    prefixUrl: baseUrl,
    headers: {
      "Freerouting-Profile-ID": profileId,
      "Freerouting-Environment-Host": "tscircuit/circuit-json-to-dsn",
    },
  })

  // 1. Create a session
  const session = await ky.post("sessions/create").json<SessionResponse>()

  // 2. Enqueue a job
  const job = await ky
    .post("jobs/enqueue", {
      json: {
        session_id: session.id,
        name: "circuit-json-to-dsn-test",
        priority: "NORMAL",
      },
    })
    .json<JobResponse>()

  // 3. Submit input (DSN as base64)
  const dsnBase64 = Buffer.from(dsnString).toString("base64")

  await ky.post(`jobs/${job.id}/input`, {
    json: {
      filename: "input.dsn",
      data: dsnBase64,
    },
  })

  // 4. Start the job
  await ky.put(`jobs/${job.id}/start`)

  // 5. Poll for completion
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const status = await ky.get(`jobs/${job.id}`).json<JobResponse>()

    if (status.state === "COMPLETED") {
      break
    }

    if (status.state === "FAILED" || status.state === "CANCELLED") {
      throw new Error(`Job ${status.state.toLowerCase()}: ${job.id}`)
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  if (Date.now() - startTime >= timeout) {
    throw new Error(`Job timed out after ${timeout}ms`)
  }

  // 6. Get the output
  const output = await ky.get(`jobs/${job.id}/output`).json<OutputResponse>()

  // Decode base64 SES data
  const sesString = Buffer.from(output.data, "base64").toString("utf-8")

  return sesString
}
