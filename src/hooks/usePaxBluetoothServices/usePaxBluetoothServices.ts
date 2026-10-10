import { Pax } from '@/pax';
import { useCallback, useRef } from 'react';

import { PaxBluetoothCharacteristics } from './enums/PaxBluetoothCharacteristics';
import { PaxBluetoothServices } from './enums/PaxBluetoothServices';
import useBluetooth from './useBluetooth';

export interface UsePaxBluetoothServicesState {
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  eventListener: {
    startListening: (callback: (event: Event) => void) => Promise<void>;
    isListenerAdded: boolean;
  };
  readFromMainService: () => Promise<Pax.lib.messages.MessageAbs>;
  writeToMainService: (packet: Pax.lib.PaxEncryptedPacket) => Promise<void>;
}

export const usePaxBluetoothServices = (
  serial: Pax.lib.PaxSerial,
): UsePaxBluetoothServicesState => {
  const {
    connected,
    connect,
    disconnect,
    isListenerAdded,
    readFromCharacteristic,
    addCharacteristicListener,
    writeToCharacteristic,
  } = useBluetooth(
    PaxBluetoothServices.MainService,
    Object.values(PaxBluetoothServices),
  );

  // Web Bluetooth rejects overlapping GATT operations, so every read and
  // write goes through one promise chain.
  const gattQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T>(operation: () => Promise<T>): Promise<T> => {
    const result = gattQueue.current.then(operation);
    gattQueue.current = result.catch(() => undefined);
    return result;
  }, []);

  const startListening = useCallback(
    (callback: (event: Event) => void): Promise<void> => {
      if (!connected) return Promise.reject('Not connected');
      if (isListenerAdded) return Promise.reject('Listener already added');

      return addCharacteristicListener(
        PaxBluetoothCharacteristics.Notifications,
        callback,
      );
    },
    [addCharacteristicListener, connected, isListenerAdded],
  );

  const readFromMainService =
    useCallback(async (): Promise<Pax.lib.messages.MessageAbs> => {
      const response = await enqueue(() =>
        readFromCharacteristic(
          PaxBluetoothServices.MainService,
          PaxBluetoothCharacteristics.Read,
        ),
      );
      return Pax.api.get(
        new Pax.lib.PaxEncryptedPacket(response.buffer),
        serial,
      ).message;
    }, [enqueue, readFromCharacteristic, serial]);

  const writeToMainService = useCallback(
    (packet: Pax.lib.PaxEncryptedPacket): Promise<void> =>
      enqueue(() =>
        writeToCharacteristic(
          PaxBluetoothServices.MainService,
          PaxBluetoothCharacteristics.Write,
          packet,
        ),
      ),
    [enqueue, writeToCharacteristic],
  );

  return {
    connect,
    disconnect,
    connected,
    eventListener: {
      startListening,
      isListenerAdded,
    },
    readFromMainService,
    writeToMainService,
  };
};
