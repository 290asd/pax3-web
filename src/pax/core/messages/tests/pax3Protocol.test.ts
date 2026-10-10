import { Pax3Imp } from '@/pax/core/crypt';
import { Devices, DynamicModes, Messages } from '@/pax/shared/enums';
import { PaxDecryptedPacket } from '@/pax/shared/models/Packet';
import { PaxSerial } from '@/pax/shared/models/PaxSerial';
import {
  celsiusToRaw,
  rawToCelsius,
  rawToFahrenheit,
} from '@/pax/shared/utils/pax3Temperature';
import { describe, expect, it } from 'vitest';

import { BytesMessage } from '../BytesMessage';
import { DeviceNameMessage, deviceNameError } from '../DeviceNameMessage';
import { HeaterSetPointMessage } from '../HeaterSetPointMessage';
import { buildDynamicModeMessages } from '../dynamicMode';

const bytes = (message: { packet: PaxDecryptedPacket }) =>
  Array.from(new Uint8Array(message.packet.buffer));

describe('PAX 3 temperature conversion (from the official app)', () => {
  it('maps the slider range to 174–215 °C / 341–420 °F', () => {
    expect(rawToCelsius(1870)).toBe(174);
    expect(rawToCelsius(2350)).toBe(215);
    expect(rawToFahrenheit(2350)).toBe(420);
    expect(celsiusToRaw(215)).toBe(2350);
  });

  it('round-trips whole degrees across the range', () => {
    for (let celsius = 175; celsius <= 215; celsius++) {
      expect(rawToCelsius(celsiusToRaw(celsius))).toBe(celsius);
    }
  });

  it('writes the raw set point as uint16 LE', () => {
    expect(
      bytes(HeaterSetPointMessage.createWithRaw(2350)).slice(0, 3),
    ).toEqual([Messages.ATTRIBUTE_HEATER_SET_POINT, 0x2e, 0x09]);
  });
});

describe('DeviceNameMessage', () => {
  it('round-trips a name', () => {
    const message = DeviceNameMessage.createWithName('My PAX');
    expect(bytes(message).slice(0, 3)).toEqual([10, 6, 'M'.charCodeAt(0)]);
    expect(new DeviceNameMessage(message.packet).name).toBe('My PAX');
  });

  it('rejects names the official app rejects', () => {
    expect(deviceNameError('')).toBeDefined();
    expect(deviceNameError('   ')).toBeDefined();
    expect(deviceNameError('dfu_test')).toBeDefined();
    expect(deviceNameError('sixteen chars!!!')).toBeDefined();
    expect(deviceNameError('ok')).toBeUndefined();
  });
});

describe('BytesMessage / dynamic mode', () => {
  it('reads the first payload byte', () => {
    const message = BytesMessage.create(Messages.ATTRIBUTE_LOCKED, [1]);
    expect(
      new BytesMessage(Messages.ATTRIBUTE_LOCKED, message.packet).value,
    ).toBe(1);
  });

  it('sends mode, heating profile and brightness override', () => {
    const [mode, profile, brightness] = buildDynamicModeMessages(
      DynamicModes.STEALTH,
    );
    expect(bytes(mode)).toEqual([Messages.ATTRIBUTE_DYNAMIC_MODE, 3]);
    expect(bytes(profile).length).toBe(1 + 11 * 2);
    expect(bytes(profile).slice(0, 3)).toEqual([25, 1200 & 0xff, 1200 >> 8]);
    expect(bytes(brightness)).toEqual([Messages.ATTRIBUTE_BRIGHTNESS, 30, 1]);
    expect(bytes(buildDynamicModeMessages(DynamicModes.BOOST)[2])).toEqual([
      Messages.ATTRIBUTE_BRIGHTNESS,
      0,
      2,
    ]);
  });
});

describe('Pax3Imp encryption', () => {
  it('pads writes to whole blocks and round-trips', () => {
    const crypt = new Pax3Imp(new PaxSerial('KRZQ2NW9', Devices.PAX3));
    const plain = DeviceNameMessage.createWithName('abcdefghijklmno').packet;
    const encrypted = crypt.encrypt(plain);
    expect(encrypted.byteLength).toBe(32 + 16);
    const decrypted = new Uint8Array(crypt.decrypt(encrypted).buffer);
    expect(Array.from(decrypted.slice(0, plain.byteLength))).toEqual(
      Array.from(new Uint8Array(plain.buffer)),
    );
  });
});
