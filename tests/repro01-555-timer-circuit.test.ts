import { CircuitJsonToDsnConverter } from "../lib/CircuitJsonToDsnConverter"
import { expect, test } from "bun:test"
import circuitJson from "./assets/555-timer-circuit.json"

test("repro01-555-timer-circuit", async () => {
  const converter = new CircuitJsonToDsnConverter(circuitJson as any)

  converter.runUntilFinished()

  Bun.write("./debug-output/555-timer-circuit.dsn", converter.getOutputString())
})
