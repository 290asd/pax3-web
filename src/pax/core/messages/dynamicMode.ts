import { DynamicModes, Messages } from '../../shared/enums';
import { BytesMessage } from './BytesMessage';

// Heating profiles the official Android app sends with each dynamic mode
// (HEATING_PARAMETERS, 11 × uint16 LE): standbyTemperature,
// noMotionToStandbyTime, noLipCoolDownTemperatureChange, noLipCoolDownStart,
// noLipCoolDownRate, noLipPowerOffTime, boostTemperatureChange,
// rampTargetTemperature, rampStartingTemperature, rampRate, option flags.
// Flags: 1 heater enabled, 2 standby, 4 no-lip cooling, 8 no-lip shutdown,
// 16 lip boost, 32 custom temperature, 64 ramping.
const HEATING_PROFILES: Record<DynamicModes, number[]> = {
  [DynamicModes.STANDARD]: [1600, 30, 150, 20, 30, 180, 39, 2300, 1990, 20, 63],
  [DynamicModes.BOOST]: [1750, 60, 70, 30, 20, 180, 112, 2300, 1990, 20, 63],
  [DynamicModes.EFFICIENCY]: [
    1600, 30, 150, 20, 30, 180, 39, 2350, 2050, 20, 95,
  ],
  [DynamicModes.STEALTH]: [1200, 15, 300, 9, 100, 180, 0, 2300, 2040, 20, 63],
  [DynamicModes.FLAVOR]: [1600, 15, 100, 10, 100, 180, 84, 2300, 2040, 20, 63],
};

const uint16LE = (values: number[]) =>
  values.flatMap(value => [value & 0xff, value >> 8]);

// Switching mode is three writes: the mode, its heating profile and a
// brightness override (Stealth dims LEDs to 30; [0, 2] clears the override).
export const buildDynamicModeMessages = (
  mode: DynamicModes,
): BytesMessage[] => [
  BytesMessage.create(Messages.ATTRIBUTE_DYNAMIC_MODE, [mode]),
  BytesMessage.create(
    Messages.ATTRIBUTE_HEATING_PARAMETERS,
    uint16LE(HEATING_PROFILES[mode]),
  ),
  BytesMessage.create(
    Messages.ATTRIBUTE_BRIGHTNESS,
    mode === DynamicModes.STEALTH ? [30, 1] : [0, 2],
  ),
];
