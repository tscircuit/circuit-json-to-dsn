import type { CircuitJson } from "circuit-json"
import type { SpectraDsn } from "dsnts"
import { DsnNet, DsnPins } from "dsnts"
import { ConverterStage } from "../types"

/**
 * Adds the network section to the DSN file.
 *
 * This stage handles:
 * 1. Creating net definitions from source_net and source_trace elements
 * 2. Associating pins (from pads/holes) with their nets via port connections
 *
 * Network structure in DSN:
 * (network
 *   (net <net_name>
 *     (pins <component_id>-<pin_id> ...)
 *   )
 * )
 *
 * Pin naming in DSN:
 * - Format: "<component_name>-<pin_number>"
 * - Example: "R1_simple_resistor_0-1" or "U1_lm555_0-2"
 *
 * Connected source ports and source nets form one DSN net, including indirect
 * connections through other traces. Explicit net names take precedence over
 * generated pin-based names. Unconnected pads retain single-pin nets.
 */
export class AddNetworkStage extends ConverterStage<CircuitJson, SpectraDsn> {
  override _step(): void {
    const { spectraDsn, db } = this.ctx

    if (!spectraDsn) {
      throw new Error("SpectraDsn instance not initialized in context")
    }

    if (!spectraDsn.network) {
      throw new Error("DsnNetwork not initialized in SpectraDsn")
    }

    // Build map from source_component_id to pcb_component_id
    const sourceCompToPcbCompMap = new Map<string, string>()
    for (const pcbComp of db.pcb_component.list()) {
      if (pcbComp.source_component_id) {
        sourceCompToPcbCompMap.set(
          pcbComp.source_component_id,
          pcbComp.pcb_component_id,
        )
      }
    }

    // Build map of source_port_id to pad info
    const padsBySourcePortId = new Map<
      string,
      {
        pcbComponentId: string
        pinNumber: string
        sourcePortId: string
      }
    >()

    // Process SMT pads
    for (const pad of db.pcb_smtpad.list()) {
      if (!pad.pcb_port_id) continue

      const pcbPort = db.pcb_port
        .list()
        .find((p) => p.pcb_port_id === pad.pcb_port_id)
      if (!pcbPort) continue

      const sourcePort = db.source_port
        .list()
        .find((p) => p.source_port_id === pcbPort.source_port_id)
      if (!sourcePort || !sourcePort.source_component_id) continue

      const pcbComponentId = sourceCompToPcbCompMap.get(
        sourcePort.source_component_id,
      )
      if (!pcbComponentId) continue

      const pinNumber =
        sourcePort.port_hints?.find((hint) => !Number.isNaN(Number(hint))) ||
        sourcePort.name ||
        "1"

      padsBySourcePortId.set(sourcePort.source_port_id, {
        pcbComponentId,
        pinNumber,
        sourcePortId: sourcePort.source_port_id,
      })
    }

    // Process plated holes
    for (const hole of db.pcb_plated_hole.list()) {
      if (!hole.pcb_port_id) continue

      const pcbPort = db.pcb_port
        .list()
        .find((p) => p.pcb_port_id === hole.pcb_port_id)
      if (!pcbPort) continue

      const sourcePort = db.source_port
        .list()
        .find((p) => p.source_port_id === pcbPort.source_port_id)
      if (!sourcePort || !sourcePort.source_component_id) continue

      const pcbComponentId = sourceCompToPcbCompMap.get(
        sourcePort.source_component_id,
      )
      if (!pcbComponentId) continue

      const pinNumber =
        sourcePort.port_hints?.find((hint) => !Number.isNaN(Number(hint))) ||
        sourcePort.name ||
        "1"

      padsBySourcePortId.set(sourcePort.source_port_id, {
        pcbComponentId,
        pinNumber,
        sourcePortId: sourcePort.source_port_id,
      })
    }

    // Join source ports and named nets before assigning physical pins.
    const parents = new Map<string, string>()
    const findRoot = (id: string): string => {
      let root = id
      while (parents.has(root)) root = parents.get(root)!
      while (id !== root) {
        const parent = parents.get(id)!
        parents.set(id, root)
        id = parent
      }
      return root
    }

    for (const trace of db.source_trace.list()) {
      const connections = [
        ...(trace.connected_source_port_ids ?? []).map((id) => `port:${id}`),
        ...(trace.connected_source_net_ids ?? []).map((id) => `net:${id}`),
      ]
      if (connections.length === 0) continue
      const root = findRoot(connections[0]!)
      for (const id of connections.slice(1)) {
        const otherRoot = findRoot(id)
        if (otherRoot !== root) parents.set(otherRoot, root)
      }
    }

    // Explicit net names take precedence; aliases use a stable name.
    const namesByRoot = new Map<string, string>()
    for (const sourceNet of db.source_net.list()) {
      const root = findRoot(`net:${sourceNet.source_net_id}`)
      const name = `${sourceNet.name}_${sourceNet.source_net_id}`
      const previousName = namesByRoot.get(root)
      if (previousName === undefined || name < previousName) {
        namesByRoot.set(root, name)
      }
    }

    const groups = new Map<string, { defaultName: string; pins: Set<string> }>()
    for (const padInfo of padsBySourcePortId.values()) {
      const root = findRoot(`port:${padInfo.sourcePortId}`)
      const pinRef = `${padInfo.pcbComponentId}-${padInfo.pinNumber}`
      const defaultName = `Net-(${padInfo.pcbComponentId}-Pad${padInfo.pinNumber})`
      const group = groups.get(root)
      if (group) {
        group.pins.add(pinRef)
        if (defaultName < group.defaultName) group.defaultName = defaultName
      } else {
        groups.set(root, { defaultName, pins: new Set([pinRef]) })
      }
    }

    const netMap = new Map<string, Set<string>>()
    for (const [root, group] of groups) {
      netMap.set(namesByRoot.get(root) ?? group.defaultName, group.pins)
    }

    // Create DsnNet objects
    const nets: DsnNet[] = []

    for (const netName of Array.from(netMap.keys()).sort()) {
      const pins = netMap.get(netName)!
      // Only create net if it has pins
      if (pins.size === 0) continue

      // Create DsnPins child with pin references
      const dsnPins = new DsnPins({
        pinRefs: Array.from(pins).sort(),
      })

      // Create net with DsnPins as a child (not using pins property directly)
      const net = new DsnNet({
        netName,
      })
      net.otherChildren = [dsnPins]

      nets.push(net)
    }

    // Set nets in network
    spectraDsn.network.nets = nets

    this.finished = true
  }

  override getOutput(): SpectraDsn {
    if (!this.ctx.spectraDsn) {
      throw new Error("SpectraDsn not initialized in context")
    }
    return this.ctx.spectraDsn
  }
}
