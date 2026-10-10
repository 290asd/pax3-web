// PAX 3 does not use °C * 10 for temperatures. The official Android app
// (com.pax.app 3.0.3) converts between display units and the device's raw
// units with these piecewise-linear formulas (integer math). See docs/PROTOCOL.md.

export type TemperatureUnit = 'C' | 'F';

// Raw range the official app maps its temperature slider to (≈175–215 °C).
export const PAX3_RAW_MIN = 1870;
export const PAX3_RAW_MAX = 2350;

const div = (a: number, b: number) => Math.trunc(a / b);

export const rawToCelsius = (raw: number): number =>
  raw < 1980 ? div((raw + 4) * 10, 109) + 3 : div(raw, 12) + 20;

export const celsiusToRaw = (celsius: number): number =>
  celsius < 185 ? div((celsius - 3) * 109, 10) + 6 : (celsius - 20) * 12 + 10;

export const rawToFahrenheit = (raw: number): number =>
  raw < 1986 ? div(raw * 6, 37) + 38 : div(raw, 6) + 29;

export const rawToUnit = (raw: number, unit: TemperatureUnit): number =>
  unit === 'C' ? rawToCelsius(raw) : rawToFahrenheit(raw);
