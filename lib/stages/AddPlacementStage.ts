import type { CircuitJson } from "circuit-json"
import type { SpectraDsn } from "dsnts"
import { DsnComponent, DsnPlace } from "dsnts"
import { ConverterStage } from "../types"
import { applyToPoint } from "transformation-matrix"

/**
 * Adds the placement section to the DSN file.
 *
 * This stage handles:
 * 1. Reading pcb_component elements from circuit JSON
 * 2. Creating DsnComponent entries for each component
 * 3. Creating DsnPlace entries with transformed coordinates
 * 4. Handling component rotation and side (front/back)
 *
 * Placement format in DSN:
 * (placement
 *   (component <component_id>
 *     (place <component_id> <x> <y> <side> <rotation>)
 *   )
 * )
 *
 * Side mapping:
 * - top layer -> "front"
 * - bottom layer -> "back"
 *
 * Rotation:
 * - Circuit JSON rotation is in degrees
 * - DSN rotation is also in degrees (0-360)
 */
export class AddPlacementStage extends ConverterStage<CircuitJson, SpectraDsn> {
  override _step(): void {
    const { spectraDsn, db, circuitJsonToDsnTransformMatrix } = this.ctx

    if (!spectraDsn) {
      throw new Error("SpectraDsn instance not initialized in context")
    }

    if (!spectraDsn.placement) {
      throw new Error("DsnPlacement not initialized in SpectraDsn")
    }

    if (!circuitJsonToDsnTransformMatrix) {
      throw new Error("Transform matrix not initialized in context")
    }

    // Get all pcb_component elements from circuit JSON
    const pcbComponents = db.pcb_component.list()

    // Collect all components first
    const components: DsnComponent[] = []

    // Create a DsnComponent for each pcb_component
    for (const pcbComponent of pcbComponents) {
      // Get component ID (use pcb_component_id)
      const componentId = pcbComponent.pcb_component_id

      // Get position (default to origin if not provided)
      const x = pcbComponent.center?.x ?? 0
      const y = pcbComponent.center?.y ?? 0

      // Transform coordinates from circuit JSON space (mm) to DSN space (μm)
      const transformed = applyToPoint(circuitJsonToDsnTransformMatrix, {
        x,
        y,
      })

      // Get rotation (default to 0 if not provided)
      const rotation = pcbComponent.rotation ?? 0

      // Determine side (front or back)
      // Circuit JSON uses "top" and "bottom" layer names
      const layer = pcbComponent.layer ?? "top"
      const side = layer === "bottom" ? "back" : "front"

      // Create DsnPlace object
      const place = new DsnPlace({
        componentRef: componentId,
        x: transformed.x,
        y: transformed.y,
        side,
        rotation,
      })

      // Create DsnComponent with the place
      const component = new DsnComponent({
        imageId: componentId,
        places: [place],
      })

      components.push(component)
    }

    // Set all components at once
    spectraDsn.placement.components = components

    this.finished = true
  }

  override getOutput(): SpectraDsn {
    if (!this.ctx.spectraDsn) {
      throw new Error("SpectraDsn not initialized in context")
    }
    return this.ctx.spectraDsn
  }
}
