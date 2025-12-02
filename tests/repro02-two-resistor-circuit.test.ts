import { CircuitJsonToDsnConverter } from "../lib/CircuitJsonToDsnConverter"
import { expect, test } from "bun:test"
import circuitJson from "./assets/two-resistor-circuit.json"

test("repro02-two-resistor-circuit", async () => {
  const converter = new CircuitJsonToDsnConverter(circuitJson as any)

  converter.runUntilFinished()

  Bun.write(
    "./debug-output/two-resistor-circuit.dsn",
    converter.getOutputString(),
  )
})
