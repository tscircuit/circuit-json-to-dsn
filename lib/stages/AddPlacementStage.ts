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
 * 2. Creating DsnComponent entries for each unique footprint
 * 3. Creating DsnPlace entries with transformed coordinates
 * 4. Handling component rotation and side (front/back)
 *
 * Placement format in DSN:
 * (placement
 *   (component <footprint_name>
 *     (place <component_ref> <x> <y> <side> <rotation>)
 *     (place <component_ref2> <x2> <y2> <side2> <rotation2>)
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
    const {
      spectraDsn,
      db,
      circuitJsonToDsnTransformMatrix,
      componentToFootprintName,
    } = this.ctx

    if (!spectraDsn) {
      throw new Error("SpectraDsn instance not initialized in context")
    }

    if (!spectraDsn.placement) {
      throw new Error("DsnPlacement not initialized in SpectraDsn")
    }

    if (!circuitJsonToDsnTransformMatrix) {
      throw new Error("Transform matrix not initialized in context")
    }

    if (!componentToFootprintName) {
      throw new Error(
        "componentToFootprintName not initialized in context (AddLibraryStage must run first)",
      )
    }

    // Get all pcb_component elements from circuit JSON
    const pcbComponents = db.pcb_component.list()

    // Group places by footprint name
    const footprintToPlaces = new Map<string, DsnPlace[]>()

    // Create DsnPlace entries for each pcb_component
    for (const pcbComponent of pcbComponents) {
      // Get component ID (use pcb_component_id)
      const componentId = pcbComponent.pcb_component_id

      // Get the footprint name from the context (set by AddLibraryStage)
      const footprintName = componentToFootprintName.get(componentId)

      // Skip if component wasn't processed (no pads/holes)
      if (!footprintName) {
        continue
      }

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

      // Add to footprint group
      if (!footprintToPlaces.has(footprintName)) {
        footprintToPlaces.set(footprintName, [])
      }
      footprintToPlaces.get(footprintName)!.push(place)
    }

    // Create DsnComponent entries - one per unique footprint
    const components: DsnComponent[] = []
    for (const [footprintName, places] of footprintToPlaces) {
      const component = new DsnComponent({
        imageId: footprintName,
        places,
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
