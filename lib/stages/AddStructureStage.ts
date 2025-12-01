import type { CircuitJson } from "circuit-json"
import type { SpectraDsn } from "dsnts"
import {
  DsnBoundary,
  DsnPath,
  DsnLayer,
  DsnRule,
  DsnVia,
  DsnClearance,
  Width,
} from "dsnts"
import { ConverterStage } from "../types"
import { applyToPoint } from "transformation-matrix"

/**
 * Adds the complete structure section to the DSN file.
 *
 * This stage handles:
 * 1. Layer structure definition (F.Cu, B.Cu, etc.) with proper indices
 * 2. Board boundary as a rectangular path
 * 3. Via definitions
 * 4. Design rules (width, clearances)
 *
 * Board boundary:
 * - Default to 100mm x 100mm if not provided
 * - Calculate corners relative to center point
 * - Transform corners using the context's transformation matrix
 * - Create closed rectangular path (5 points to close the loop)
 *
 * Layer structure:
 * - Generates proper DSN layer format with nested type and property
 * - Each layer has a sequential index starting from 0
 * - Format: (layer <name> (type signal) (property (index <n>)))
 *
 * Rules:
 * - Default trace width: 200μm
 * - Default clearance: 200μm
 * - SMD-specific clearances
 */
export class AddStructureStage extends ConverterStage<CircuitJson, SpectraDsn> {
  override _step(): void {
    const { spectraDsn, db, circuitJsonToDsnTransformMatrix } = this.ctx

    if (!spectraDsn) {
      throw new Error("SpectraDsn instance not initialized in context")
    }

    if (!spectraDsn.structure) {
      throw new Error("DsnStructure not initialized in SpectraDsn")
    }

    if (!circuitJsonToDsnTransformMatrix) {
      throw new Error("Transform matrix not initialized in context")
    }

    // Find the PCB board element from circuit JSON
    const pcbBoard = db.pcb_board.list()[0]

    // Get number of layers (default to 2-layer board)
    const numLayers = pcbBoard?.num_layers ?? 2

    // Generate layer structure based on number of layers
    const layers = this.generateLayers(numLayers)
    spectraDsn.structure.layers = layers

    // Default to 100mm x 100mm if not provided
    const boardWidth = pcbBoard?.width ?? 100
    const boardHeight = pcbBoard?.height ?? 100
    const centerX = pcbBoard?.center?.x ?? 0
    const centerY = pcbBoard?.center?.y ?? 0

    // Calculate corners in circuit JSON space (mm)
    const halfWidth = boardWidth / 2
    const halfHeight = boardHeight / 2

    // Define corner points in circuit JSON space
    const corners = [
      { x: centerX - halfWidth, y: centerY - halfHeight }, // Top left
      { x: centerX + halfWidth, y: centerY - halfHeight }, // Top right
      { x: centerX + halfWidth, y: centerY + halfHeight }, // Bottom right
      { x: centerX - halfWidth, y: centerY + halfHeight }, // Bottom left
      { x: centerX - halfWidth, y: centerY - halfHeight }, // Close path
    ]

    // Transform all corners using the transformation matrix
    const coordinates: number[] = []
    for (const corner of corners) {
      const transformed = applyToPoint(circuitJsonToDsnTransformMatrix, corner)
      coordinates.push(transformed.x, transformed.y)
    }

    // Create the boundary path
    const boundaryPath = new DsnPath({
      layer: "pcb",
      width: 0,
      coordinates,
    })

    // Create and set the boundary
    const boundary = new DsnBoundary({
      paths: [boundaryPath],
    })

    spectraDsn.structure.boundary = boundary

    const CLEARANCE_VALUE = 200
    const CLEARANCE_TYPE_DEFAULT_SMD = "default_smd"
    const CLEARANCE_TYPE_SMD_SMD = "smd_smd"
    const CLEARANCE_VALUE_SMD_SMD = 50
    // TODO: the trace_width value should be from the circuit json pcb_trace element
    const TRACE_WIDTH_VALUE = 200

    // Add design rules
    const width = new Width(TRACE_WIDTH_VALUE)
    const clearances = [
      new DsnClearance({ value: CLEARANCE_VALUE }),
      new DsnClearance({
        value: CLEARANCE_VALUE,
        type: CLEARANCE_TYPE_DEFAULT_SMD,
      }),
      new DsnClearance({
        value: CLEARANCE_VALUE_SMD_SMD,
        type: CLEARANCE_TYPE_SMD_SMD,
      }),
    ]
    const rule = new DsnRule()
    rule.otherChildren = [width, ...clearances]
    spectraDsn.structure.rules = [rule]

    this.finished = true
  }

  /**
   * Generate layer structure for the PCB based on number of layers.
   * Follows KiCad layer naming conventions.
   *
   * Format: (layer <name> (type signal) (property (index <n>)))
   *
   * For 2-layer board: F.Cu (index 0), B.Cu (index 1)
   * For 4-layer board: F.Cu (index 0), In1.Cu (index 1), In2.Cu (index 2), B.Cu (index 3)
   * For 6-layer board: F.Cu (index 0), In1.Cu (index 1), ..., B.Cu (index 5)
   * etc.
   */
  private generateLayers(numLayers: number): DsnLayer[] {
    const layers: DsnLayer[] = []

    if (numLayers < 2) {
      throw new Error("PCB must have at least 2 layers")
    }

    let layerIndex = 0

    // Front copper layer (always index 0)
    layers.push(
      new DsnLayer({
        layerName: "F.Cu",
        type: "signal",
        index: layerIndex++,
      }),
    )

    // Inner layers (if more than 2 layers)
    for (let i = 1; i < numLayers - 1; i++) {
      layers.push(
        new DsnLayer({
          layerName: `In${i}.Cu`,
          type: "signal",
          index: layerIndex++,
        }),
      )
    }

    // Back copper layer (always last index)
    layers.push(
      new DsnLayer({
        layerName: "B.Cu",
        type: "signal",
        index: layerIndex,
      }),
    )

    return layers
  }

  override getOutput(): SpectraDsn {
    if (!this.ctx.spectraDsn) {
      throw new Error("SpectraDsn not initialized in context")
    }
    return this.ctx.spectraDsn
  }
}
