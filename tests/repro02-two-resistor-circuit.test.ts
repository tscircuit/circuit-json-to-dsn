import { CircuitJsonToDsnConverter } from "../lib/CircuitJsonToDsnConverter"
import { expect, test } from "bun:test"
import circuitJson from "./assets/two-resistor-circuit.json"

test("repro02-two-resistor-circuit", async () => {
  const converter = new CircuitJsonToDsnConverter(circuitJson as any)

  converter.runUntilFinished()

  expect(converter.getOutputString()).toMatchInlineSnapshot(`
    "(pcb
      "circuit-design"
      (parser circuit-json-to-dsn)
      (resolution um 10)
      (unit um)
      (structure
        (boundary
          (path pcb 0 -5000 -5000 5000 -5000 5000 5000 -5000 5000 -5000 -5000 )
        )
        (layer F.Cu
          (type signal)
          (property
            (index 0)
          )
        )
        (layer B.Cu
          (type signal)
          (property
            (index 1)
          )
        )
        (rule
          (width 200)
          (clearance 200 )
          (clearance 200 (type default_smd) )
          (clearance 50 (type smd_smd) )
        )
        (via
          "Via[0-1]_600:300_um"
        )
      )
      (placement
        (component
          "footprint_1560x640_0"
          (place pcb_component_0 0 0 front 0 )
          (place pcb_component_1 -2560.0000000000005 0 front 0 )
        )
      )
      (library
        (image
          footprint_1560x640_0
          (pin p540x640 1 -510 0 0)
          (pin p540x640 2 510 0 0)
        )
        (padstack
          p540x640
          (shape
            (rect F.Cu -270 -320 270 320 )
          )
        )
        (padstack
          Via[0-1]_600:300_um
          (shape
            (circle F.Cu 600 )
          )
          (shape
            (circle B.Cu 600 )
          )
          (attach off)
        )
      )
      (network
        (net "Net-(pcb_component_0-Pad1)"
          (pins pcb_component_0-1 pcb_component_1-1)
        )
        (net "Net-(pcb_component_0-Pad2)"
          (pins pcb_component_0-2)
        )
        (net "Net-(pcb_component_1-Pad2)"
          (pins pcb_component_1-2)
        )
      )
      (wiring)
    )"
  `)

  Bun.write(
    "./debug-output/two-resistor-circuit.dsn",
    converter.getOutputString(),
  )
})
