import { CircuitJsonToDsnConverter } from "../lib/CircuitJsonToDsnConverter"
import { expect, test } from "bun:test"
import circuitJson from "./assets/motor-driver-breakout-circuit.json"

test("repro03-motor-driver-breakout", async () => {
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
          (path pcb 0 -15000 -15000 15000 -15000 15000 15000 -15000 15000 -15000 -15000 )
        )
        (layer F.Cu
          (type signal)
          (property
            (index 0)
          )
        )
        (layer In1.Cu
          (type signal)
          (property
            (index 1)
          )
        )
        (layer In2.Cu
          (type signal)
          (property
            (index 2)
          )
        )
        (layer B.Cu
          (type signal)
          (property
            (index 3)
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
          "footprint_7432x8474_0"
          (place pcb_component_0 -5.6843418860808015e-11 -5.6843418860808015e-11 front 0 )
        )
        (component
          "footprint_1200x18980_1"
          (place pcb_component_1 -9000 0 front 0 )
          (place pcb_component_2 9000 0 front 0 )
        )
        (component
          "footprint_600x1600_2"
          (place pcb_component_3 -7000 8000 front 0 )
          (place pcb_component_4 -5000 8000 front 0 )
          (place pcb_component_5 5000 8000 front 0 )
        )
      )
      (library
        (image
          footprint_7432x8474_0
          (pin p1324x308 1 3562.09599999994 -3575.049999999976 0)
          (pin p1324x308 2 3562.09599999994 -2925.064000000077 0)
          (pin p1324x308 3 3562.09599999994 -2275.077999999951 0)
          (pin p1324x308 4 3562.09599999994 -1625.0920000000522 0)
          (pin p1324x308 5 3562.09599999994 -975.1059999999259 0)
          (pin p1324x308 6 3562.09599999994 -324.8659999999861 0)
          (pin p1324x308 7 3562.09599999994 325.1200000001402 0)
          (pin p1324x308 8 3562.09599999994 975.1060000000391 0)
          (pin p1324x308 9 3562.09599999994 1625.0920000000517 0)
          (pin p1324x308 10 3562.09599999994 2275.0780000000645 0)
          (pin p1324x308 11 3562.09599999994 2925.064000000077 0)
          (pin p1324x308 12 3562.09599999994 3575.049999999976 0)
          (pin p1324x308 24 -3562.09599999994 -3575.049999999976 0)
          (pin p1324x308 23 -3562.09599999994 -2925.064000000077 0)
          (pin p1324x308 22 -3562.09599999994 -2275.077999999951 0)
          (pin p1324x308 21 -3562.09599999994 -1625.0920000000517 0)
          (pin p1324x308 20 -3562.09599999994 -975.1059999999254 0)
          (pin p1324x308 19 -3562.09599999994 -324.86599999998566 0)
          (pin p1324x308 18 -3562.09599999994 325.12000000014064 0)
          (pin p1324x308 17 -3562.09599999994 975.1060000000396 0)
          (pin p1324x308 16 -3562.09599999994 1625.0920000000522 0)
          (pin p1324x308 15 -3562.09599999994 2275.0780000000645 0)
          (pin p1324x308 14 -3562.09599999994 2925.064000000077 0)
          (pin p1324x308 13 -3562.09599999994 3575.049999999976 0)
        )
        (image
          footprint_1200x18980_1
          (pin p1200_hole 1 0 -8889.999715520009 0)
          (pin p1200_hole 2 0 -6349.999796800006 0)
          (pin p1200_hole 3 0 -3809.999878080004 0)
          (pin p1200_hole 4 0 -1269.9999593600016 0)
          (pin p1200_hole 5 0 1269.9999593600016 0)
          (pin p1200_hole 6 0 3809.9998780800047 0)
          (pin p1200_hole 7 0 6349.999796800006 0)
          (pin p1200_hole 8 0 8889.999715520009 0)
        )
        (image
          footprint_600x1600_2
          (pin p600x600 1 0 -500 0)
          (pin p600x600 2 0 500 0)
        )
        (padstack
          p1324x308
          (shape
            (rect F.Cu -662 -154 662 154 )
          )
        )
        (padstack
          p1200_hole
          (shape
            (circle F.Cu 1200 )
          )
          (shape
            (circle B.Cu 1200 )
          )
        )
        (padstack
          p600x600
          (shape
            (rect F.Cu -300 -300 300 300 )
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
        (net "Net-(pcb_component_1-Pad8)"
          (pins pcb_component_1-8 pcb_component_3-2 pcb_component_4-2 pcb_component_0-24 pcb_component_0-14)
        )
        (net "Net-(pcb_component_1-Pad5)"
          (pins pcb_component_1-5 pcb_component_0-1 pcb_component_0-2)
        )
        (net "Net-(pcb_component_1-Pad4)"
          (pins pcb_component_1-4 pcb_component_0-5 pcb_component_0-6)
        )
        (net "Net-(pcb_component_1-Pad3)"
          (pins pcb_component_1-3 pcb_component_0-7 pcb_component_0-8)
        )
        (net "Net-(pcb_component_1-Pad2)"
          (pins pcb_component_1-2 pcb_component_0-11 pcb_component_0-12)
        )
        (net "Net-(pcb_component_2-Pad7)"
          (pins pcb_component_2-7 pcb_component_0-15)
        )
        (net "Net-(pcb_component_2-Pad6)"
          (pins pcb_component_2-6 pcb_component_0-16)
        )
        (net "Net-(pcb_component_2-Pad5)"
          (pins pcb_component_2-5 pcb_component_0-17)
        )
        (net "Net-(pcb_component_2-Pad4)"
          (pins pcb_component_2-4 pcb_component_0-19)
        )
        (net "Net-(pcb_component_2-Pad3)"
          (pins pcb_component_2-3 pcb_component_0-21)
        )
        (net "Net-(pcb_component_2-Pad2)"
          (pins pcb_component_2-2 pcb_component_0-22)
        )
        (net "Net-(pcb_component_2-Pad1)"
          (pins pcb_component_2-1 pcb_component_0-23)
        )
        (net "Net-(pcb_component_3-Pad2)"
          (pins pcb_component_3-2 pcb_component_0-24 pcb_component_0-14 pcb_component_0-13)
        )
        (net "Net-(pcb_component_4-Pad2)"
          (pins pcb_component_4-2 pcb_component_0-24 pcb_component_0-14 pcb_component_0-13)
        )
        (net "VCC_source_net_0"
          (pins pcb_component_1-7 pcb_component_5-1 pcb_component_0-20)
        )
        (net "GND_source_net_1"
          (pins pcb_component_1-6 pcb_component_1-1 pcb_component_2-8 pcb_component_3-1 pcb_component_4-1 pcb_component_5-2 pcb_component_0-18 pcb_component_0-3 pcb_component_0-4 pcb_component_0-9 pcb_component_0-10)
        )
      )
      (wiring)
    )"
  `)

  Bun.write(
    "./debug-output/motor-driver-breakout.dsn",
    converter.getOutputString(),
  )
})
