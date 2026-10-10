import { Messages } from '../../shared/enums/Messages';
import { PaxDecryptedPacket } from '../../shared/models/Packet';
import { ReadAndWriteMessageAbs } from './ReadAndWriteMessageAbs';

// Generic attribute message: [attribute, ...payload]. Used for the
// single-byte attributes (lock, charge status, game mode, dynamic mode,
// UI mode) and for writes that need no decoding (heating parameters).
export class BytesMessage extends ReadAndWriteMessageAbs {
  readonly value: number;

  constructor(
    readonly messageType: Messages,
    readonly packet: PaxDecryptedPacket,
  ) {
    super();
    this.value = packet.getUint8(1);
  }

  static create(messageType: Messages, payload: number[]): BytesMessage {
    const bytes = new Uint8Array([messageType, ...payload]);
    return new BytesMessage(messageType, new PaxDecryptedPacket(bytes.buffer));
  }
}
