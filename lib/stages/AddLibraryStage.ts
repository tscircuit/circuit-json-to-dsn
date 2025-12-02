import type { CircuitJson } from "circuit-json"
import type { SpectraDsn } from "dsnts"
import {
  DsnImage,
  DsnPin,
  DsnPadstack,
  DsnShape,
  DsnCircle,
  DsnRect,
  DsnPolygon,
} from "dsnts"
import { ConverterStage } from "../types"
import { applyToPoint } from "transformation-matrix"

/**
 * Adds the library section to the DSN file.
 *
 * This stage handles:
 * 1. Creating padstack definitions for pcb_smtpad and pcb_plated_hole elements
 * 2. Creating image (footprint) definitions for each unique footprint
 * 3. Adding pins to images with references to their padstacks
 *
 * Library structure in DSN:
 * (library
 *   (image <footprint_name>
 *     (pin <padstack_id> <pin_id> <x> <y> [rotation])
 *     ...
 *   )
 *   (padstack <padstack_id>
 *     (shape (circle <layer> <diameter>))
 *     ...
 *   )
 * )
 *
 * IMPORTANT: Components with the same footprint (same pad shapes, sizes, and
 * relative positions) share a single image definition. The uniqueness is
 * determined by generating a "footprint signature" from the pad configuration.
 *
 * Padstack naming convention:
 * - Circle: "p<diameter>" (e.g., "p1000" for 1mm diameter in μm)
 * - Rect: "p<width>x<height>" (e.g., "p1000x2000")
 * - Polygon: "p<hash>" (based on points)
 *
 * Pin positioning:
 * - Pin positions are relative to component origin
 * - Coordinates are transformed from circuit JSON space (mm) to DSN space (μm)
 */
export class AddLibraryStage extends ConverterStage<CircuitJson, SpectraDsn> {
  private processedPadstacks = new Set<string>()

  /**
   * Maps footprint signature to footprint name (image id)
   */
  private footprintSignatureToName = new Map<string, string>()

  override _step(): void {
    const { spectraDsn, db, circuitJsonToDsnTransformMatrix } = this.ctx

    if (!spectraDsn) {
      throw new Error("SpectraDsn instance not initialized in context")
    }

    if (!spectraDsn.library) {
      throw new Error("DsnLibrary not initialized in SpectraDsn")
    }

    if (!circuitJsonToDsnTransformMatrix) {
      throw new Error("Transform matrix not initialized in context")
    }

    // Initialize the component to footprint mapping in context
    this.ctx.componentToFootprintName = new Map<string, string>()

    // Get all components
    const pcbComponents = db.pcb_component.list()

    // Track images and padstacks
    const images: DsnImage[] = []
    const padstacks: DsnPadstack[] = []

    // Track unique footprints by their signature
    const footprintSignatureToImage = new Map<string, DsnImage>()
    let footprintCounter = 0

    // Process each component to create images
    for (const pcbComponent of pcbComponents) {
      const componentId = pcbComponent.pcb_component_id

      // Get all pads and holes for this component
      const smtPads = db.pcb_smtpad
        .list()
        .filter((pad: any) => pad.pcb_component_id === componentId)
      const platedHoles = db.pcb_plated_hole
        .list()
        .filter((hole: any) => hole.pcb_component_id === componentId)

      // Skip if no pads/holes
      if (smtPads.length === 0 && platedHoles.length === 0) {
        continue
      }

      // Generate footprint signature based on pad/hole configurations
      const signature = this.generateFootprintSignature(
        smtPads,
        platedHoles,
        pcbComponent,
      )

      // Check if we already have an image with this signature
      if (footprintSignatureToImage.has(signature)) {
        // Reuse existing image
        const existingImage = footprintSignatureToImage.get(signature)!
        this.ctx.componentToFootprintName!.set(
          componentId,
          existingImage.imageId!,
        )
        continue
      }

      // Create new image for this unique footprint
      const pins: DsnPin[] = []

      // Process SMT pads
      for (const smtPad of smtPads) {
        const padstackId = this.ensurePadstackForSmtPad(smtPad, padstacks)
        const pin = this.createPinFromSmtPad(
          smtPad,
          padstackId,
          pcbComponent,
          circuitJsonToDsnTransformMatrix,
          db,
        )
        pins.push(pin)
      }

      // Process plated holes
      for (const platedHole of platedHoles) {
        const padstackId = this.ensurePadstackForPlatedHole(
          platedHole,
          padstacks,
        )
        const pin = this.createPinFromPlatedHole(
          platedHole,
          padstackId,
          pcbComponent,
          circuitJsonToDsnTransformMatrix,
          db,
        )
        pins.push(pin)
      }

      // Generate a footprint name
      const footprintName = this.generateFootprintName(
        smtPads,
        platedHoles,
        pcbComponent,
        footprintCounter,
      )
      footprintCounter++

      // Create image
      const image = new DsnImage({
        imageId: footprintName,
        pins,
      })

      images.push(image)
      footprintSignatureToImage.set(signature, image)
      this.footprintSignatureToName.set(signature, footprintName)
      this.ctx.componentToFootprintName!.set(componentId, footprintName)
    }

    // Set images and padstacks in library
    spectraDsn.library.images = images
    spectraDsn.library.padstacks = padstacks

    this.finished = true
  }

  /**
   * Generates a signature that uniquely identifies a footprint based on its
   * pad/hole configuration. Components with the same signature share an image.
   *
   * The signature is based on:
   * - Number of pads/holes
   * - Shape and dimensions of each pad/hole
   * - Relative positions of pads/holes (normalized)
   */
  private generateFootprintSignature(
    smtPads: any[],
    platedHoles: any[],
    component: any,
  ): string {
    const componentX = component.center?.x ?? 0
    const componentY = component.center?.y ?? 0

    // Collect pad info: shape, dimensions, and relative position
    const padInfos: string[] = []

    for (const pad of smtPads) {
      const relX = Math.round((pad.x - componentX) * 1000) // Convert to μm for precision
      const relY = Math.round((pad.y - componentY) * 1000)

      let padDesc: string
      switch (pad.shape) {
        case "circle":
          padDesc = `c:${Math.round(pad.radius * 2 * 1000)}`
          break
        case "rect":
        case "rotated_rect":
          padDesc = `r:${Math.round(pad.width * 1000)}x${Math.round(pad.height * 1000)}`
          break
        case "pill":
        case "rotated_pill":
          padDesc = `p:${Math.round(pad.width * 1000)}x${Math.round(pad.height * 1000)}`
          break
        default:
          padDesc = `u:${pad.shape}`
      }

      padInfos.push(`${padDesc}@${relX},${relY}`)
    }

    for (const hole of platedHoles) {
      const relX = Math.round((hole.x - componentX) * 1000)
      const relY = Math.round((hole.y - componentY) * 1000)

      let holeDesc: string
      switch (hole.shape) {
        case "circle":
          holeDesc = `hc:${Math.round(hole.outer_diameter * 1000)}`
          break
        case "oval":
        case "pill":
          holeDesc = `ho:${Math.round(hole.outer_width * 1000)}x${Math.round(hole.outer_height * 1000)}`
          break
        default:
          holeDesc = `hu:${hole.shape}`
      }

      padInfos.push(`${holeDesc}@${relX},${relY}`)
    }

    // Sort to ensure consistent signature regardless of order
    padInfos.sort()

    return padInfos.join("|")
  }

  /**
   * Generates a human-readable footprint name based on the component's characteristics.
   */
  private generateFootprintName(
    smtPads: any[],
    platedHoles: any[],
    component: any,
    counter: number,
  ): string {
    // Try to determine footprint name from component dimensions
    const width = Math.round((component.width ?? 0) * 1000)
    const height = Math.round((component.height ?? 0) * 1000)

    if (width > 0 && height > 0) {
      return `footprint_${width}x${height}_${counter}`
    }

    // Fallback to pad count
    const totalPads = smtPads.length + platedHoles.length
    return `footprint_${totalPads}pin_${counter}`
  }

  /**
   * Ensures a padstack exists for an SMT pad and returns its ID
   */
  private ensurePadstackForSmtPad(
    smtPad: any,
    padstacks: DsnPadstack[],
  ): string {
    let padstackId: string

    switch (smtPad.shape) {
      case "circle": {
        const diameter = Math.round(smtPad.radius * 2 * 1000) // Convert to μm
        padstackId = `p${diameter}`
        break
      }
      case "rect":
      case "rotated_rect": {
        const width = Math.round(smtPad.width * 1000)
        const height = Math.round(smtPad.height * 1000)
        padstackId = `p${width}x${height}`
        break
      }
      case "pill":
      case "rotated_pill": {
        const width = Math.round(smtPad.width * 1000)
        const height = Math.round(smtPad.height * 1000)
        padstackId = `p${width}x${height}_pill`
        break
      }
      case "polygon": {
        // For polygons, create a hash-based ID
        const pointsStr = smtPad.points
          .map((p: any) => `${p.x},${p.y}`)
          .join("_")
        padstackId = `p${this.simpleHash(pointsStr)}`
        break
      }
      default:
        throw new Error(`Unsupported SMT pad shape: ${smtPad.shape}`)
    }

    // Create padstack if it doesn't exist
    if (!this.processedPadstacks.has(padstackId)) {
      const padstack = this.createPadstackForSmtPad(smtPad, padstackId)
      padstacks.push(padstack)
      this.processedPadstacks.add(padstackId)
    }

    return padstackId
  }

  /**
   * Ensures a padstack exists for a plated hole and returns its ID
   */
  private ensurePadstackForPlatedHole(
    platedHole: any,
    padstacks: DsnPadstack[],
  ): string {
    let padstackId: string

    switch (platedHole.shape) {
      case "circle": {
        const diameter = Math.round(platedHole.outer_diameter * 1000)
        padstackId = `p${diameter}_hole`
        break
      }
      case "oval":
      case "pill": {
        const width = Math.round(platedHole.outer_width * 1000)
        const height = Math.round(platedHole.outer_height * 1000)
        padstackId = `p${width}x${height}_hole`
        break
      }
      case "circular_hole_with_rect_pad": {
        const width = Math.round(platedHole.rect_pad_width * 1000)
        const height = Math.round(platedHole.rect_pad_height * 1000)
        padstackId = `p${width}x${height}_recthole`
        break
      }
      default:
        throw new Error(`Unsupported plated hole shape: ${platedHole.shape}`)
    }

    // Create padstack if it doesn't exist
    if (!this.processedPadstacks.has(padstackId)) {
      const padstack = this.createPadstackForPlatedHole(platedHole, padstackId)
      padstacks.push(padstack)
      this.processedPadstacks.add(padstackId)
    }

    return padstackId
  }

  /**
   * Creates a padstack definition for an SMT pad
   */
  private createPadstackForSmtPad(
    smtPad: any,
    padstackId: string,
  ): DsnPadstack {
    const shapes: DsnShape[] = []
    const layer = smtPad.layer ?? "top"
    const layerNum = layer === "bottom" ? "2" : "1"

    switch (smtPad.shape) {
      case "circle": {
        const diameter = Math.round(smtPad.radius * 2 * 1000)
        const circle = new DsnCircle({
          layer: layerNum,
          diameter,
        })
        const shape = new DsnShape()
        shape.otherChildren = [circle]
        shapes.push(shape)
        break
      }
      case "rect":
      case "rotated_rect": {
        const width = Math.round(smtPad.width * 1000)
        const height = Math.round(smtPad.height * 1000)
        const rect = new DsnRect({
          layer: layerNum,
          x1: -width / 2,
          y1: -height / 2,
          x2: width / 2,
          y2: height / 2,
        })
        const shape = new DsnShape()
        shape.otherChildren = [rect]
        shapes.push(shape)
        break
      }
      case "pill":
      case "rotated_pill": {
        // Approximate pill as rect for now (DSN doesn't have native pill shape)
        const width = Math.round(smtPad.width * 1000)
        const height = Math.round(smtPad.height * 1000)
        const rect = new DsnRect({
          layer: layerNum,
          x1: -width / 2,
          y1: -height / 2,
          x2: width / 2,
          y2: height / 2,
        })
        const shape = new DsnShape()
        shape.otherChildren = [rect]
        shapes.push(shape)
        break
      }
      case "polygon": {
        const coordinates: number[] = []
        for (const point of smtPad.points) {
          // Handle both point formats (object or array)
          const x = Array.isArray(point) ? point[0] : point.x
          const y = Array.isArray(point) ? point[1] : point.y
          const transformed = applyToPoint(
            this.ctx.circuitJsonToDsnTransformMatrix!,
            { x, y },
          )
          coordinates.push(transformed.x, transformed.y)
        }
        const polygon = new DsnPolygon({
          layer: layerNum,
          apertureWidth: 0,
          coordinates,
        })
        const shape = new DsnShape()
        shape.otherChildren = [polygon]
        shapes.push(shape)
        break
      }
    }

    return new DsnPadstack({
      padstackId,
      shapes,
    })
  }

  /**
   * Creates a padstack definition for a plated hole
   */
  private createPadstackForPlatedHole(
    platedHole: any,
    padstackId: string,
  ): DsnPadstack {
    const shapes: DsnShape[] = []

    // Plated holes are on all layers
    for (const layerNum of ["1", "2"]) {
      switch (platedHole.shape) {
        case "circle": {
          const diameter = Math.round(platedHole.outer_diameter * 1000)
          const circle = new DsnCircle({
            layer: layerNum,
            diameter,
          })
          const shape = new DsnShape()
          shape.otherChildren = [circle]
          shapes.push(shape)
          break
        }
        case "oval":
        case "pill": {
          const width = Math.round(platedHole.outer_width * 1000)
          const height = Math.round(platedHole.outer_height * 1000)
          const rect = new DsnRect({
            layer: layerNum,
            x1: -width / 2,
            y1: -height / 2,
            x2: width / 2,
            y2: height / 2,
          })
          const shape = new DsnShape()
          shape.otherChildren = [rect]
          shapes.push(shape)
          break
        }
        case "circular_hole_with_rect_pad": {
          const width = Math.round(platedHole.rect_pad_width * 1000)
          const height = Math.round(platedHole.rect_pad_height * 1000)
          const rect = new DsnRect({
            layer: layerNum,
            x1: -width / 2,
            y1: -height / 2,
            x2: width / 2,
            y2: height / 2,
          })
          const shape = new DsnShape()
          shape.otherChildren = [rect]
          shapes.push(shape)
          break
        }
      }
    }

    return new DsnPadstack({
      padstackId,
      shapes,
    })
  }

  /**
   * Creates a pin from an SMT pad
   */
  private createPinFromSmtPad(
    smtPad: any,
    padstackId: string,
    component: any,
    transformMatrix: any,
    db: any,
  ): DsnPin {
    // Calculate relative position (pad position - component position)
    const componentX = component.center?.x ?? 0
    const componentY = component.center?.y ?? 0
    const relativeX = smtPad.x - componentX
    const relativeY = smtPad.y - componentY

    // Transform to DSN space
    const transformed = applyToPoint(transformMatrix, {
      x: relativeX,
      y: relativeY,
    })

    // Get pin number from pcb_port -> source_port
    let pinId = "1" // Default
    if (smtPad.pcb_port_id) {
      const pcbPort = db.pcb_port
        .list()
        .find((p: any) => p.pcb_port_id === smtPad.pcb_port_id)
      if (pcbPort) {
        const sourcePort = db.source_port
          .list()
          .find((p: any) => p.source_port_id === pcbPort.source_port_id)
        if (sourcePort) {
          // Try to get pin number from port_hints or name
          pinId =
            sourcePort.port_hints?.find(
              (hint: any) => !Number.isNaN(Number(hint)),
            ) ||
            sourcePort.name ||
            "1"
        }
      }
    }

    return new DsnPin({
      padstackId,
      pinId,
      x: transformed.x,
      y: transformed.y,
      rotation: smtPad.ccw_rotation ?? 0,
    })
  }

  /**
   * Creates a pin from a plated hole
   */
  private createPinFromPlatedHole(
    platedHole: any,
    padstackId: string,
    component: any,
    transformMatrix: any,
    db: any,
  ): DsnPin {
    // Calculate relative position (hole position - component position)
    const componentX = component.center?.x ?? 0
    const componentY = component.center?.y ?? 0
    const relativeX = platedHole.x - componentX
    const relativeY = platedHole.y - componentY

    // Transform to DSN space
    const transformed = applyToPoint(transformMatrix, {
      x: relativeX,
      y: relativeY,
    })

    // Get pin number from pcb_port -> source_port
    let pinId = "1" // Default
    if (platedHole.pcb_port_id) {
      const pcbPort = db.pcb_port
        .list()
        .find((p: any) => p.pcb_port_id === platedHole.pcb_port_id)
      if (pcbPort) {
        const sourcePort = db.source_port
          .list()
          .find((p: any) => p.source_port_id === pcbPort.source_port_id)
        if (sourcePort) {
          // Try to get pin number from port_hints or name
          pinId =
            sourcePort.port_hints?.find(
              (hint: any) => !Number.isNaN(Number(hint)),
            ) ||
            sourcePort.name ||
            "1"
        }
      }
    }

    return new DsnPin({
      padstackId,
      pinId,
      x: transformed.x,
      y: transformed.y,
      rotation: platedHole.ccw_rotation ?? 0,
    })
  }

  /**
   * Simple hash function for generating padstack IDs
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  override getOutput(): SpectraDsn {
    if (!this.ctx.spectraDsn) {
      throw new Error("SpectraDsn not initialized in context")
    }
    return this.ctx.spectraDsn
  }
}
