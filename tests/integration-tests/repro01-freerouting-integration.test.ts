import { CircuitJsonToDsnConverter } from "../../lib/CircuitJsonToDsnConverter"
import { expect, test } from "bun:test"
import { routeDsnWithFreerouting } from "../fixtures/routeDsnWithFreerouting"
import circuitJson from "../assets/two-resistor-circuit.json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { stackSvgsHorizontally } from "stack-svgs"

test.skip("freerouting integration - two resistor circuit", async () => {
  const circuitSvgBeforeRouting = convertCircuitJsonToPcbSvg(circuitJson as any)

  // 1. Convert circuit JSON to DSN
  const converter = new CircuitJsonToDsnConverter(circuitJson as any)
  converter.runUntilFinished()
  const dsnString = converter.getOutputString()

  // 2. Send to freerouting API and get SES output
  const sesOutput = await routeDsnWithFreerouting(dsnString)

  // 3. Verify we got valid SES output
  expect(sesOutput).toContain("(session")
  expect(sesOutput).toContain("(routes")

  // Optionally save for debugging
  await Bun.write("./debug-output/two-resistor-circuit.ses", sesOutput)

  // TODO: parse the SES output and get the circuit SVG after routing
})
