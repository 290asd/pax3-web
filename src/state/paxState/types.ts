import { Pax } from '@/pax';

export interface PaxState {
  // Temperatures are raw PAX 3 units, see pax3Temperature.ts
  actualTemperatureRaw: number;
  heaterSetPointRaw: number;
  heatingSate?: Pax.lib.HeatingStates;
  colorTheme?: Pax.lib.ColorTheme;
  batteryPercentage?: number;
  brightness?: number;
  haptics?: number;
  isLocked?: boolean;
  // bit 0: charger connected, bit 4: charging complete
  chargeStatus?: number;
  dynamicMode?: Pax.lib.DynamicModes;
  gameMode?: Pax.lib.GameModes;
  deviceName?: string;
  // 0 = default LEDs, otherwise the custom color theme is active
  uiMode?: number;
}
