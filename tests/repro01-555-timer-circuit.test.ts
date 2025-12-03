import { CircuitJsonToDsnConverter } from "../lib/CircuitJsonToDsnConverter"
import { expect, test } from "bun:test"
import circuitJson from "./assets/555-timer-circuit.json"

test("repro01-555-timer-circuit", async () => {
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
          (path pcb 0 -25000 -10000 25000 -10000 25000 10000 -25000 10000 -25000 -10000 )
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
          "footprint_2200x7200_0"
          (place pcb_component_0 -18000 0 front 0 )
          (place pcb_component_8 18000 0 front 0 )
        )
        (component
          "footprint_9120x9120_1"
          (place pcb_component_1 5.6843418860808015e-11 5.6843418860808015e-11 front 0 )
        )
        (component
          "footprint_540x1660_2"
          (place pcb_component_2 -7000 0 front 0 )
          (place pcb_component_3 7000 0 front 0 )
          (place pcb_component_4 10000 0 front 0 )
          (place pcb_component_7 8000 -4000 front 0 )
        )
        (component
          "footprint_1560x640_3"
          (place pcb_component_5 -7000 3000 front 0 )
          (place pcb_component_6 1000 -7000 front 0 )
        )
      )
      (library
        (image
          footprint_2200x7200_0
          (pin p2200_hole 1 0 -2499.9950000000126 0)
          (pin p2200_hole 2 0 2499.9950000000126 0)
        )
        (image
          footprint_9120x9120_1
          (pin p1500_hole 1 -3810.0000000000027 3810.000000000002 0)
          (pin p1500_hole 2 -3810.0000000000023 1269.9999999999247 0)
          (pin p1500_hole 3 -3810.0000000000023 -1270.0000000000389 0)
          (pin p1500_hole 4 -3810.000000000002 -3810.0000000000027 0)
          (pin p1500_hole 8 3810.000000000002 3810.0000000000027 0)
          (pin p1500_hole 7 3810.0000000000023 1269.9999999999252 0)
          (pin p1500_hole 6 3810.0000000000023 -1270.0000000000384 0)
          (pin p1500_hole 5 3810.0000000000027 -3810.000000000002 0)
        )
        (image
          footprint_540x1660_2
          (pin p640x540 1 0 -510 0)
          (pin p640x540 2 0 510 0)
        )
        (image
          footprint_1560x640_3
          (pin p540x640 1 -509.9999999999998 0 0)
          (pin p540x640 2 509.9999999999998 0 0)
        )
        (padstack
          p2200_hole
          (shape
            (circle F.Cu 2200 )
          )
          (shape
            (circle B.Cu 2200 )
          )
        )
        (padstack
          p1500_hole
          (shape
            (circle F.Cu 1500 )
          )
          (shape
            (circle B.Cu 1500 )
          )
        )
        (padstack
          p640x540
          (shape
            (rect F.Cu -320 -270 320 270 )
          )
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
        (net "Net-(pcb_component_1-Pad7)"
          (pins pcb_component_1-7 pcb_component_1-2)
        )
        (net "Net-(pcb_component_2-Pad1)"
          (pins pcb_component_2-1 pcb_component_1-8)
        )
        (net "Net-(pcb_component_2-Pad2)"
          (pins pcb_component_2-2 pcb_component_5-1)
        )
        (net "Net-(pcb_component_3-Pad1)"
          (pins pcb_component_3-1 pcb_component_1-4)
        )
        (net "Net-(pcb_component_3-Pad2)"
          (pins pcb_component_3-2 pcb_component_1-3)
        )
        (net "Net-(pcb_component_4-Pad1)"
          (pins pcb_component_4-1 pcb_component_3-2)
        )
        (net "Net-(pcb_component_4-Pad2)"
          (pins pcb_component_4-2 pcb_component_7-1)
        )
        (net "Net-(pcb_component_5-Pad1)"
          (pins pcb_component_5-1 pcb_component_1-6)
        )
        (net "Net-(pcb_component_6-Pad1)"
          (pins pcb_component_6-1 pcb_component_1-5)
        )
        (net "Net-(pcb_component_8-Pad1)"
          (pins pcb_component_8-1 pcb_component_7-1)
        )
        (net "VCC_source_net_0"
          (pins pcb_component_0-1 pcb_component_1-8)
        )
        (net "GND_source_net_1"
          (pins pcb_component_0-2 pcb_component_1-1 pcb_component_5-2 pcb_component_6-2 pcb_component_7-2 pcb_component_8-2)
        )
      )
      (wiring)
    )"
  `)

  Bun.write("./debug-output/555-timer-circuit.dsn", converter.getOutputString())
})
