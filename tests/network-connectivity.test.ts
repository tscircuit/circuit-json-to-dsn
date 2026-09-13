import { expect, test } from "bun:test"
import type { CircuitJson, SourceTrace } from "circuit-json"
import { DsnPins } from "dsnts"
import { CircuitJsonToDsnConverter } from "../lib"
import timerCircuit from "./assets/555-timer-circuit.json"

const makeCircuit = (): CircuitJson => {
  const circuit: CircuitJson = []
  for (let i = 0; i < 4; i++) {
    circuit.push(
      {
        type: "pcb_component",
        pcb_component_id: `pcb_component_${i}`,
        source_component_id: `source_component_${i}`,
        center: { x: i * 2, y: 0 },
        width: 1,
        height: 1,
        rotation: 0,
        layer: "top",
        obstructs_within_bounds: false,
      },
      {
        type: "source_port",
        source_port_id: `source_port_${i}`,
        source_component_id: `source_component_${i}`,
        name: "1",
        port_hints: ["1"],
      },
      {
        type: "pcb_port",
        pcb_port_id: `pcb_port_${i}`,
        source_port_id: `source_port_${i}`,
        pcb_component_id: `pcb_component_${i}`,
        x: i * 2,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: `pcb_smtpad_${i}`,
        pcb_component_id: `pcb_component_${i}`,
        pcb_port_id: `pcb_port_${i}`,
        shape: "rect",
        x: i * 2,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
    )
  }
  return circuit
}

const trace = (
  id: string,
  ports: number[],
  nets: string[] = [],
): SourceTrace => ({
  type: "source_trace",
  source_trace_id: id,
  connected_source_port_ids: ports.map((i) => `source_port_${i}`),
  connected_source_net_ids: nets,
})

const convert = (circuit: CircuitJson) => {
  const converter = new CircuitJsonToDsnConverter(circuit)
  converter.runUntilFinished()
  return converter.getOutput().network!.nets.map((net) => ({
    name: net.netName,
    pins: net.otherChildren.find(
      (child): child is DsnPins => child instanceof DsnPins,
    )!.pinRefs,
  }))
}

test("chained traces form one net and preserve isolated physical pads", () => {
  const nets = convert([
    ...makeCircuit(),
    trace("source_trace_0", [0, 1]),
    trace("source_trace_1", [1, 2]),
  ])
  expect(nets).toEqual([
    {
      name: "Net-(pcb_component_0-Pad1)",
      pins: ["pcb_component_0-1", "pcb_component_1-1", "pcb_component_2-1"],
    },
    { name: "Net-(pcb_component_3-Pad1)", pins: ["pcb_component_3-1"] },
  ])
})

test("a named net includes ports connected through other traces", () => {
  const nets = convert([
    ...makeCircuit(),
    {
      type: "source_net",
      source_net_id: "source_net_0",
      name: "VCC",
      member_source_group_ids: [],
    },
    trace("source_trace_0", [0], ["source_net_0"]),
    trace("source_trace_1", [1, 0]),
    trace("source_trace_2", [2, 1]),
  ])
  expect(nets.find((net) => net.name === "VCC_source_net_0")?.pins).toEqual([
    "pcb_component_0-1",
    "pcb_component_1-1",
    "pcb_component_2-1",
  ])
  expect(nets).toHaveLength(2)
})

test("source-net aliases merge only when explicitly connected", () => {
  const nets = convert([
    ...makeCircuit(),
    {
      type: "source_net",
      source_net_id: "source_net_0",
      name: "VCC",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "source_net_1",
      name: "VCC",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "source_net_2",
      name: "VCC",
      member_source_group_ids: [],
    },
    trace("source_trace_0", [0], ["source_net_0"]),
    trace("source_trace_1", [], ["source_net_0", "source_net_1"]),
    trace("source_trace_2", [1], ["source_net_1"]),
    trace("source_trace_3", [2], ["source_net_2"]),
  ])
  expect(nets.find((net) => net.name === "VCC_source_net_0")?.pins).toEqual([
    "pcb_component_0-1",
    "pcb_component_1-1",
  ])
  expect(nets.find((net) => net.name === "VCC_source_net_2")?.pins).toEqual([
    "pcb_component_2-1",
  ])
  expect(nets).toHaveLength(3)
})

test("trace ordering and direction do not change exported net names or pins", () => {
  const traces = [
    trace("source_trace_0", [2, 1]),
    trace("source_trace_1", [1, 0]),
  ]
  const expected = convert([...makeCircuit(), ...traces])
  const reversed = traces.toReversed().map((element) => ({
    ...element,
    connected_source_port_ids: element.connected_source_port_ids.toReversed(),
  }))
  expect(convert([...makeCircuit().toReversed(), ...reversed])).toEqual(
    expected,
  )
})

test("plated-hole pins are retained both connected and isolated", () => {
  const circuit = makeCircuit().filter(
    (element) =>
      element.type !== "pcb_smtpad" || element.pcb_smtpad_id !== "pcb_smtpad_3",
  )
  circuit.push({
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "pcb_plated_hole_3",
    pcb_component_id: "pcb_component_3",
    pcb_port_id: "pcb_port_3",
    shape: "circle",
    x: 6,
    y: 0,
    outer_diameter: 1,
    hole_diameter: 0.5,
    layers: ["top", "bottom"],
  })
  expect(
    convert(circuit).find((net) => net.name === "Net-(pcb_component_3-Pad1)")
      ?.pins,
  ).toEqual(["pcb_component_3-1"])
  expect(
    convert([...circuit, trace("source_trace_0", [0, 3])]).find(
      (net) => net.name === "Net-(pcb_component_0-Pad1)",
    )?.pins,
  ).toEqual(["pcb_component_0-1", "pcb_component_3-1"])
})

test("a source port without a physical pad still connects routed endpoints", () => {
  const circuit = makeCircuit()
  circuit.push(
    {
      type: "source_port",
      source_port_id: "source_port_4",
      source_component_id: "source_component_4",
      name: "junction",
    },
    trace("source_trace_0", [4, 0]),
    trace("source_trace_1", [4, 1]),
  )
  expect(
    convert(circuit).some(
      (net) =>
        net.pins.includes("pcb_component_0-1") &&
        net.pins.includes("pcb_component_1-1"),
    ),
  ).toBe(true)
})

test("the 555 timer fixture exports each physical pin in exactly one net", () => {
  const nets = convert(timerCircuit as CircuitJson)
  const pins = nets.flatMap((net) => net.pins)
  expect(new Set(pins).size).toBe(pins.length)
  expect(nets).toHaveLength(8)
  expect(nets.find((net) => net.name === "VCC_source_net_0")?.pins).toEqual([
    "pcb_component_0-1",
    "pcb_component_1-8",
    "pcb_component_2-1",
  ])
  expect(
    nets.some((net) =>
      ["pcb_component_1-3", "pcb_component_3-2", "pcb_component_4-1"].every(
        (pin) => net.pins.includes(pin),
      ),
    ),
  ).toBe(true)
})
