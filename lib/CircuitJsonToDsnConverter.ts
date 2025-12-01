import { SpectraDsn } from "dsnts"
import type { CircuitJson } from "circuit-json"
import { cju } from "@tscircuit/circuit-json-util"
import type { ConverterContext, ConverterStage } from "./types"
import { scale } from "transformation-matrix"
import { InitializeDsnStage } from "./stages/InitializeDsnStage"
import { CreateBoardBoundaryStage } from "./stages/CreateBoardBoundaryStage"

export class CircuitJsonToDsnConverter {
  ctx: ConverterContext

  pipeline: ConverterStage<CircuitJson, SpectraDsn>[]
  currentStageIndex = 0

  finished = false

  get currentStage() {
    return this.pipeline[this.currentStageIndex]
  }

  constructor(circuitJson: CircuitJson) {
    const CIRCUIT_JSON_TO_DSN_SCALE = 1000 // Convert mm to μm

    this.ctx = {
      circuitJson,
      db: cju(circuitJson),
      spectraDsn: new SpectraDsn({
        designName: "circuit-json-to-dsn",
      }),
      circuitJsonToDsnTransformMatrix: scale(CIRCUIT_JSON_TO_DSN_SCALE), // mm to μm
    }

    this.pipeline = [
      new InitializeDsnStage(circuitJson, this.ctx),
      new CreateBoardBoundaryStage(circuitJson, this.ctx),
      // TODO: Implement remaining stages
      // new AddComponentsAndPadsStage(circuitJson, this.ctx),
      // new AddPlatedHolesStage(circuitJson, this.ctx),
      // new AddNetsStage(circuitJson, this.ctx),
      // new AddTracesStage(circuitJson, this.ctx),
      // new AddViasStage(circuitJson, this.ctx),
    ]
  }

  step() {
    if (!this.currentStage) {
      this.finished = true
      return
    }
    this.currentStage.step()
    if (this.currentStage.finished) {
      this.currentStageIndex++
    }
  }

  runUntilFinished() {
    while (!this.finished) {
      this.step()
    }
  }

  getOutput(): SpectraDsn {
    return this.ctx.spectraDsn!
  }

  /**
   * Get the output as a string
   */
  getOutputString(): string {
    return this.ctx.spectraDsn!.getString()
  }
}
