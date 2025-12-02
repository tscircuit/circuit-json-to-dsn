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
 * Net creation logic:
 * 1. Build a map of source_port_id to pad info (component name + pin number)
 * 2. For source_net elements:
 *    - Find all source_trace elements connected to the net
 *    - Get all source_port_ids from those traces
 *    - Map to component-pin identifiers
 * 3. For source_trace elements (without explicit nets):
 *    - Create nets based on connected ports
 *    - Generate net name from first connected component
 * 4. Handle unconnected pads
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

    // Map to store nets and their pins
    const netMap = new Map<string, Set<string>>()

    // Process source_trace elements to create nets
    for (const trace of db.source_trace.list()) {
      const connectedPorts = trace.connected_source_port_ids || []

      if (connectedPorts.length >= 2 && connectedPorts[0]) {
        const firstPad = padsBySourcePortId.get(connectedPorts[0])

        if (firstPad) {
          const netName = `Net-(${firstPad.pcbComponentId}-Pad${firstPad.pinNumber})`

          if (!netMap.has(netName)) {
            netMap.set(netName, new Set())
          }

          for (const portId of connectedPorts) {
            const padInfo = padsBySourcePortId.get(portId)
            if (padInfo) {
              netMap
                .get(netName)
                ?.add(`${padInfo.pcbComponentId}-${padInfo.pinNumber}`)
            }
          }
        }
      }
    }

    // Add source nets (GND, VCC, etc.)
    for (const sourceNet of db.source_net.list()) {
      const netName = `${sourceNet.name}_${sourceNet.source_net_id}`

      if (!netMap.has(netName)) {
        netMap.set(netName, new Set())
      }

      // Find all traces connected to this net
      const connectedTraces = db.source_trace
        .list()
        .filter((t) =>
          t.connected_source_net_ids?.includes(sourceNet.source_net_id),
        )

      // Add connected ports to the net
      for (const trace of connectedTraces) {
        for (const portId of trace.connected_source_port_ids || []) {
          const padInfo = padsBySourcePortId.get(portId)
          if (padInfo) {
            netMap
              .get(netName)
              ?.add(`${padInfo.pcbComponentId}-${padInfo.pinNumber}`)
          }
        }
      }
    }

    // Create DsnNet objects
    const nets: DsnNet[] = []

    for (const [netName, pins] of netMap.entries()) {
      // Only create net if it has pins
      if (pins.size === 0) continue

      // Create DsnPins child with pin references
      const dsnPins = new DsnPins({
        pinRefs: Array.from(pins),
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
