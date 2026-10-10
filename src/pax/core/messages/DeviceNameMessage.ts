import { Messages } from '../../shared/enums/Messages';
import { PaxDecryptedPacket } from '../../shared/models/Packet';
import { ReadAndWriteMessageAbs } from './ReadAndWriteMessageAbs';

// Same rules as the official app: max 15 chars, not blank, no "dfu_" prefix
// (reserved for firmware update mode). Restricted to printable ASCII because
// the device decodes the name as US-ASCII.
export const deviceNameError = (name: string): string | undefined => {
  if (!name.trim()) return 'Name cannot be empty';
  if (!/^[\x20-\x7e]{1,15}$/.test(name))
    return 'Use at most 15 plain ASCII characters';
  if (name.trim().toLowerCase().startsWith('dfu_'))
    return 'Names starting with "dfu_" are reserved';
};

// Payload: [length, ...ascii bytes]
export class DeviceNameMessage extends ReadAndWriteMessageAbs {
  readonly messageType = Messages.ATTRIBUTE_DEVICE_NAME;
  readonly name: string;

  constructor(readonly packet: PaxDecryptedPacket) {
    super();
    const length = Math.min(packet.getUint8(1), packet.byteLength - 2);
    this.name = String.fromCharCode(
      ...new Uint8Array(packet.buffer, packet.byteOffset + 2, length),
    );
  }

  static createWithName(name: string): DeviceNameMessage {
    const error = deviceNameError(name);
    if (error) throw new Error(error);
    const bytes = new Uint8Array([
      Messages.ATTRIBUTE_DEVICE_NAME,
      name.length,
      ...Array.from(name, char => char.charCodeAt(0)),
    ]);
    return new DeviceNameMessage(new PaxDecryptedPacket(bytes.buffer));
  }
}
