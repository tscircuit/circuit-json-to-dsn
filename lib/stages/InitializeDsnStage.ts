import type { CircuitJson } from "circuit-json"
import {
  SpectraDsn,
  DsnParser,
  DsnResolution,
  DsnStructure,
  DsnPlacement,
  DsnLibrary,
  DsnNetwork,
  DsnWiring,
} from "dsnts"
import { ConverterStage } from "../types"

/**
 * Initializes the basic SpectraDsn structure with parser info, resolution,
 * unit, and empty sections for structure, placement, library, network, and wiring.
 */
export class InitializeDsnStage extends ConverterStage<
  CircuitJson,
  SpectraDsn
> {
  override _step(): void {
    const { circuitJson } = this.ctx

    // Create the root SpectraDsn object
    const spectraDsn = new SpectraDsn({
      designName: "circuit-design",
    })

    // Set up parser information
    spectraDsn.parser = new DsnParser("circuit-json-to-dsn")

    // Set up resolution - DSN uses micrometers (um) with precision of 10
    spectraDsn.resolution = new DsnResolution("um", 10)

    // Set the unit to micrometers
    spectraDsn.unit = "um"

    // Initialize structure section (will be populated by later stages)
    spectraDsn.structure = new DsnStructure()

    // Initialize placement section (will be populated by AddComponentsAndPadsStage)
    spectraDsn.placement = new DsnPlacement()

    // Initialize library section (will be populated by AddComponentsAnd极dsStage and AddPlatedHolesStage)
    spectraDsn.library = new DsnLibrary()

    // Initialize network section (will be populated by AddNetsStage)
    spectraDsn.network = new DsnNetwork()

    // Initialize wiring section (will be populated by AddTracesStage and AddViasStage)
    spectraDsn.wiring = new DsnWiring()

    // Store the SpectraDsn object in the context for subsequent stages
    this.ctx.spectraDsn = spectraDsn

    this.finished = true
  }

  override getOutput(): SpectraDsn {
    if (!this.ctx.spectraDsn) {
      throw new Error("SpectraDsn not initialized in context")
    }
    return this.ctx.spectraDsn
  }
}
