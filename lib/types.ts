import type { CircuitJsonUtilObjects } from "@tscircuit/circuit-json-util"
import type { CircuitJson } from "circuit-json"
import type { SpectraDsn } from "dsnts"
import type { Matrix } from "transformation-matrix"

export interface ConverterContext {
  db: CircuitJsonUtilObjects
  circuitJson: CircuitJson
  spectraDsn?: SpectraDsn
  circuitJsonToDsnTransformMatrix?: Matrix
  /**
   * Maps pcb_component_id to the footprint name (image id) it uses.
   * Populated by AddLibraryStage, used by AddPlacementStage.
   */
  componentToFootprintName?: Map<string, string>
  /**
   * Via padstack name to be created in library.
   * Format: Via[0-1]_<outerDiameter>:<holeDiameter>_um
   * Set by AddStructureStage, used by AddLibraryStage.
   */
  viaPadstackName?: string
}

export abstract class ConverterStage<Input, Output> {
  MAX_ITERATIONS = 1000
  iteration = 0

  finished = false

  circuitJsonToDsnTransformMatrix?: Matrix

  input: Input
  ctx: ConverterContext

  constructor(input: Input, ctx: ConverterContext) {
    this.input = input
    this.ctx = ctx
  }

  step(): void {
    this.iteration++
    if (this.iteration > this.MAX_ITERATIONS) {
      throw new Error("Max iterations reached")
    }
    this._step()
  }

  _step(): void {
    throw new Error("Not implemented")
  }

  runUntilFinished(): void {
    while (!this.finished) {
      this.step()
    }
  }

  getOutput(): Output {
    throw new Error("Not implemented")
  }
}
