import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { CircuitJsonToDsnConverter } from "../lib/CircuitJsonToDsnConverter"

const board = {
  type: "pcb_board" as const,
  pcb_board_id: "pcb_board_0",
  center: { x: 0, y: 0 },
  width: 20,
  height: 20,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4" as const,
}

const component = {
  type: "pcb_component" as const,
  pcb_component_id: "pcb_component_0",
  source_component_id: "source_component_0",
  center: { x: 0, y: 0 },
  width: 4,
  height: 2,
  layer: "top" as const,
  rotation: 0,
}

function convert(platedHoles: Record<string, unknown>[]) {
  const circuitJson = [board, component, ...platedHoles] as CircuitJson
  const converter = new CircuitJsonToDsnConverter(circuitJson)
  converter.runUntilFinished()
  return converter
}

test("pill_hole_with_rect_pad plated holes convert to rectangular padstacks", () => {
  const converter = convert([
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_0",
      pcb_component_id: "pcb_component_0",
      shape: "pill_hole_with_rect_pad",
      hole_width: 0.6,
      hole_height: 1.2,
      rect_pad_width: 1.4,
      rect_pad_height: 2,
      x: 0,
      y: 0,
      layers: ["top", "bottom"],
    },
  ])

  const output = converter.getOutputString()
  expect(output).toContain("p1400x2000_recthole")
  expect(output).toContain("(rect F.Cu -700 -1000 700 1000 )")
  expect(output).toContain("(rect B.Cu -700 -1000 700 1000 )")
})

test("rotated_pill_hole_with_rect_pad uses rect_ccw_rotation on the pin", () => {
  const converter = convert([
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_0",
      pcb_component_id: "pcb_component_0",
      shape: "rotated_pill_hole_with_rect_pad",
      hole_width: 0.6,
      hole_height: 1.2,
      rect_pad_width: 1.4,
      rect_pad_height: 2,
      rect_ccw_rotation: 90,
      x: 1,
      y: 0,
      layers: ["top", "bottom"],
    },
  ])

  const output = converter.getOutputString()
  expect(output).toContain("p1400x2000_recthole")
  expect(output).toMatch(/pin p1400x2000_recthole 1 1000 0 90/)
})

test("hole_with_polygon_pad plated holes convert to polygon padstacks", () => {
  const converter = convert([
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_0",
      pcb_component_id: "pcb_component_0",
      shape: "hole_with_polygon_pad",
      hole_shape: "circle",
      hole_diameter: 0.6,
      x: 2,
      y: -1,
      layers: ["top", "bottom"],
      pad_outline: [
        { x: -1, y: -0.5 },
        { x: 1, y: -0.5 },
        { x: 1, y: 0.5 },
        { x: -1, y: 0.5 },
      ],
    },
  ])

  const output = converter.getOutputString()
  expect(output).toContain("_polyhole")
  expect(output).toContain(
    "(polygon F.Cu 0 -1000 -500 1000 -500 1000 500 -1000 500 )",
  )
  expect(output).toContain(
    "(polygon B.Cu 0 -1000 -500 1000 -500 1000 500 -1000 500 )",
  )
})
