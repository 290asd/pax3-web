import { ColorThemeMessage } from '@/pax/core/messages/ColorThemeMessage';

import {
  ActualTemperatureMessage,
  BatteryPercentageMessage,
  BrightnessMessage,
  BytesMessage,
  DeviceNameMessage,
  HapticsMessage,
  HeaterSetPointMessage,
  HeatingStateMessage,
  MessageAbs,
  TargetTemperatureMessage,
} from '../../core/messages';
import { UnknownMessage } from '../../core/messages/UnknownMessage';
import { Messages } from '../../shared/enums/Messages';
import {
  PaxDecryptedPacket,
  PaxEncryptedPacket,
} from '../../shared/models/Packet';
import { PaxSerial } from '../../shared/models/PaxSerial';
import { getEnumKeyByEnumValue } from '../../shared/utils/getEnumKeyByEnumValue';
import { GetResponse } from './models/getResponse';
import { buildPaxCryptClassFromDevice } from './utils/buildPaxCryptClassFromDevice';

export const decodeDecryptedPacket = (
  messageType: Messages,
  packet: PaxDecryptedPacket,
): MessageAbs => {
  switch (messageType) {
    case Messages.ATTRIBUTE_ACTUAL_TEMP:
      return new ActualTemperatureMessage(packet);
    case Messages.ATTRIBUTE_CURRENT_TARGET_TEMP:
      return new TargetTemperatureMessage(packet);
    case Messages.ATTRIBUTE_HEATER_SET_POINT:
      return HeaterSetPointMessage.createWithPacket(packet);
    case Messages.ATTRIBUTE_HEATING_STATE:
      return new HeatingStateMessage(packet);
    case Messages.ATTRIBUTE_COLOR_THEME:
      return ColorThemeMessage.createWithPacket(packet);
    case Messages.ATTRIBUTE_BATTERY:
      return new BatteryPercentageMessage(packet);
    case Messages.ATTRIBUTE_BRIGHTNESS:
      return BrightnessMessage.createWithPacket(packet);
    case Messages.ATTRIBUTE_HAPTIC_MODE:
      return HapticsMessage.createWithPacket(packet);
    case Messages.ATTRIBUTE_DEVICE_NAME:
      return new DeviceNameMessage(packet);
    case Messages.ATTRIBUTE_LOCKED:
    case Messages.ATTRIBUTE_CHARGE_STATUS:
    case Messages.ATTRIBUTE_GAME_MODE:
    case Messages.ATTRIBUTE_DYNAMIC_MODE:
    case Messages.ATTRIBUTE_UI_MODE:
      return new BytesMessage(messageType, packet);
    default:
      return new UnknownMessage(messageType, packet);
  }
};

export const get = (
  packet: PaxEncryptedPacket,
  paxSerial: PaxSerial,
): GetResponse => {
  const paxClass = buildPaxCryptClassFromDevice(paxSerial);
  const decryptedPacket = paxClass.decrypt(packet);
  const messageTypeInt = decryptedPacket.getUint8(0);
  const messageType = getEnumKeyByEnumValue(Messages, messageTypeInt);
  const decodedPacket = !messageType
    ? new UnknownMessage(messageTypeInt, decryptedPacket)
    : decodeDecryptedPacket(messageType, decryptedPacket);

  return { device: paxSerial.device, message: decodedPacket as MessageAbs };
};
