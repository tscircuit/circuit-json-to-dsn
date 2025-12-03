import { test, expect } from "bun:test"
import { AddStructureStage } from "../lib/stages/AddStructureStage"
import { InitializeDsnStage } from "../lib/stages/InitializeDsnStage"
import type { CircuitJson } from "circuit-json"
import { cju } from "@tscircuit/circuit-json-util"
import type { ConverterContext } from "../lib/types"
import { scale } from "transformation-matrix"

test("AddStructureStage should add structure with boundary, layers, via, and rules", () => {
  // Create a simple circuit JSON with a PCB board
  const circuitJson: CircuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      width: 50, // 50mm
      height: 30, // 30mm
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
  ]

  // Create context with transformation matrix
  const CIRCUIT_JSON_TO_DSN_SCALE = 1000 // Convert mm to μm
  const ctx: ConverterContext = {
    circuitJson,
    db: cju(circuitJson),
    circuitJsonToDsnTransformMatrix: scale(CIRCUIT_JSON_TO_DSN_SCALE),
  }

  // Initialize DSN first
  const initStage = new InitializeDsnStage(circuitJson, ctx)
  initStage.runUntilFinished()

  // Run AddStructureStage
  const stage = new AddStructureStage(circuitJson, ctx)
  stage.runUntilFinished()

  const output = stage.getOutput()

  // Check that structure components were added
  expect(output.structure).toBeDefined()
  expect(output.structure?.boundary).toBeDefined()
  expect(output.structure?.boundary?.paths).toBeDefined()
  expect(output.structure?.boundary?.paths?.length).toBe(1)

  // Check that rules were added
  expect(output.structure?.rules).toBeDefined()
  expect(output.structure?.rules?.length).toBe(1)
  const rule = output.structure?.rules?.[0]
  expect(rule?.otherChildren).toBeDefined()
  expect(rule?.otherChildren?.length).toBe(4) // 1 width + 3 clearances

  // Check width (first child)
  const width = rule?.otherChildren?.[0]
  expect(width?.token).toBe("width")

  // Check clearances (remaining children)
  const clearances = rule?.otherChildren?.slice(1)
  expect(clearances?.length).toBe(3)
  if (!clearances) throw new Error("Clearances not defined")
  for (const clearance of clearances) {
    expect(clearance.token).toBe("clearance")
  }

  const path = output.structure?.boundary?.paths?.[0]
  expect(path).toBeDefined()
  expect(path?.layer).toBe("pcb")
  expect(path?.width).toBe(0)

  // Check coordinates (50mm = 50000μm width, 30mm = 30000μm height)
  // Expected coordinates: top-left, top-right, bottom-right, bottom-left, top-left (closed)
  const coords = path?.coordinates
  expect(coords?.length).toBe(10) // 5 points * 2 coordinates each

  // Check that coordinates form a rectangle
  // Width = 50mm = 50000μm, half = 25000μm
  // Height = 30mm = 30000μm, half = 15000μm
  expect(coords?.[0]).toBe(-25000) // Top-left X
  expect(coords?.[1]).toBe(-15000) // Top-left Y
  expect(coords?.[2]).toBe(25000) // Top-right X
  expect(coords?.[3]).toBe(-15000) // Top-right Y
  expect(coords?.[4]).toBe(25000) // Bottom-right X
  expect(coords?.[5]).toBe(15000) // Bottom-right Y
  expect(coords?.[6]).toBe(-25000) // Bottom-left X
  expect(coords?.[7]).toBe(15000) // Bottom-left Y
  expect(coords?.[8]).toBe(-25000) // Close path X
  expect(coords?.[9]).toBe(-15000) // Close path Y

  expect(output.getString()).toMatchInlineSnapshot(`
    "(pcb
      "circuit-design"
      (parser circuit-json-to-dsn)
      (resolution um 10)
      (unit um)
      (structure
        (boundary
          (path pcb 0 -25000 -15000 25000 -15000 25000 15000 -25000 15000 -25000 -15000 )
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
      (placement)
      (library)
      (network)
      (wiring)
    )"
  `)
})

test("AddStructureStage should handle default board size", () => {
  // Create circuit JSON without PCB board (should use defaults)
  const circuitJson: CircuitJson = []

  // Create context with transformation matrix
  const CIRCUIT_JSON_TO_DSN_SCALE = 1000 // Convert mm to μm
  const ctx: ConverterContext = {
    circuitJson,
    db: cju(circuitJson),
    circuitJsonToDsnTransformMatrix: scale(CIRCUIT_JSON_TO_DSN_SCALE),
  }

  // Initialize DSN first
  const initStage = new InitializeDsnStage(circuitJson, ctx)
  initStage.runUntilFinished()

  // Run AddStructureStage
  const stage = new AddStructureStage(circuitJson, ctx)
  stage.runUntilFinished()

  const output = stage.getOutput()

  // Check that boundary was added with defaults (100mm x 100mm)
  const path = output.structure?.boundary?.paths?.[0]
  const coords = path?.coordinates

  // Default: 100mm = 100000μm, half = 50000μm
  expect(coords?.[0]).toBe(-50000) // Top-left X
  expect(coords?.[1]).toBe(-50000) // Top-left Y
  expect(coords?.[2]).toBe(50000) // Top-right X
  expect(coords?.[3]).toBe(-50000) // Top-right Y
})
