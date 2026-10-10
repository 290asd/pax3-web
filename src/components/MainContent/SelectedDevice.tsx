import { usePaxBluetoothServices } from '@/hooks';
import { BaseBluetoothException } from '@/hooks/usePaxBluetoothServices/useBluetooth/exceptions';
import { Pax } from '@/pax';
import { post } from '@/pax/containers/api';
import {
  BatteryPercentageMessage,
  BrightnessMessage,
  BytesMessage,
  ColorThemeMessage,
  DeviceNameMessage,
  HapticsMessage,
  HeaterSetPointMessage,
  ReadAndWriteMessageAbs,
  RequestStatusMessage,
  buildDynamicModeMessages,
  deviceNameError,
} from '@/pax/core/messages';
import { DynamicModes, GameModes, Messages } from '@/pax/shared/enums';
import { ColorTheme } from '@/pax/shared/types';
import {
  PAX3_RAW_MAX,
  PAX3_RAW_MIN,
  TemperatureUnit,
  rawToUnit,
} from '@/pax/shared/utils/pax3Temperature';
import { usePaxContext } from '@/state/hooks';
import { useLocalStorage } from '@uidotdev/usehooks';
import { isEqual } from 'lodash';
import { ReactNode, useCallback, useEffect, useState } from 'react';

import HeaterStatus from '../HeaterStatus';
import TemperatureProgress from '../TemperatureProgress';
import { ThemePicker } from '../ThemePicker';
import { hardcodedThemes } from '../ThemePicker/colors';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Connect } from './SelectedDevice/Connect';

// What the official app requests right after connecting (+ name, temperature).
const STATUS_ATTRIBUTES = [
  Messages.ATTRIBUTE_ACTUAL_TEMP,
  Messages.ATTRIBUTE_HEATER_SET_POINT,
  Messages.ATTRIBUTE_BATTERY,
  Messages.ATTRIBUTE_LOCKED,
  Messages.ATTRIBUTE_CHARGE_STATUS,
  Messages.ATTRIBUTE_DEVICE_NAME,
  Messages.ATTRIBUTE_GAME_MODE,
  Messages.ATTRIBUTE_DYNAMIC_MODE,
  Messages.ATTRIBUTE_COLOR_THEME,
  Messages.ATTRIBUTE_BRIGHTNESS,
  Messages.ATTRIBUTE_HAPTIC_MODE,
  Messages.ATTRIBUTE_UI_MODE,
];

const DYNAMIC_MODES: [DynamicModes, string][] = [
  [DynamicModes.STANDARD, 'Standard'],
  [DynamicModes.BOOST, 'Boost'],
  [DynamicModes.EFFICIENCY, 'Efficiency'],
  [DynamicModes.STEALTH, 'Stealth'],
  [DynamicModes.FLAVOR, 'Flavor'],
];

const GAMES: [GameModes, string][] = [
  [GameModes.NONE, 'Off'],
  [GameModes.PAX_RUN, 'PAX Run'],
  [GameModes.PAX_SAYS, 'PAX Says'],
  [GameModes.PAX_SPIN, 'PAX Spin'],
];

const Setting = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-sm font-semibold">{label}</h2>
    {children}
  </section>
);

interface SelectedDeviceProps {
  currentDevice: Pax.lib.PaxSerial;
  openDevicesModal: () => void;
}

export const SelectedDevice = ({ currentDevice }: SelectedDeviceProps) => {
  const { state, actions } = usePaxContext();
  const bluetoothState = usePaxBluetoothServices(currentDevice);
  const [unit, setUnit] = useLocalStorage<TemperatureUnit>(
    'temperatureUnit',
    'C',
  );
  const [setPointRaw, setSetPointRaw] = useState<number>();
  const [name, setName] = useState('');

  const send = useCallback(
    (...messages: ReadAndWriteMessageAbs[]) =>
      Promise.all(
        messages.map(message =>
          bluetoothState.writeToMainService(
            post(message, currentDevice).packet,
          ),
        ),
      ).catch(e => {
        // eslint-disable-next-line no-console
        console.error('write', String(e));
      }),
    [bluetoothState, currentDevice],
  );

  const messagesConsumer = useCallback(() => {
    if (!bluetoothState.connected) {
      return;
    }

    bluetoothState
      .readFromMainService()
      .then(message => {
        if (message instanceof Pax.lib.messages.ActualTemperatureMessage) {
          actions.setActualTemperature(message.raw);
        }
        if (message instanceof HeaterSetPointMessage) {
          actions.setHeaterSetPointTemperature(message.raw);
        }
        if (message instanceof Pax.lib.messages.HeatingStateMessage) {
          actions.setHeatingState(message.heatingState);
        }
        if (message instanceof ColorThemeMessage) {
          actions.setColorTheme(message.theme);
        }
        if (message instanceof BatteryPercentageMessage) {
          actions.setBatteryPercentage(message.percentage);
        }
        if (message instanceof BrightnessMessage) {
          actions.setBrightness(message.brightness);
        }
        if (message instanceof HapticsMessage) {
          actions.setHaptics(message.percentage);
        }
        if (message instanceof DeviceNameMessage) {
          actions.setFields({ deviceName: message.name });
        }
        if (message instanceof BytesMessage) {
          const { value } = message;
          switch (message.messageType) {
            case Messages.ATTRIBUTE_LOCKED:
              return actions.setFields({ isLocked: value !== 0 });
            case Messages.ATTRIBUTE_CHARGE_STATUS:
              return actions.setFields({ chargeStatus: value });
            case Messages.ATTRIBUTE_GAME_MODE:
              return actions.setFields({ gameMode: value });
            case Messages.ATTRIBUTE_DYNAMIC_MODE:
              return actions.setFields({ dynamicMode: value });
            case Messages.ATTRIBUTE_UI_MODE:
              return actions.setFields({ uiMode: value });
          }
        }
      })
      .catch(e => {
        if (e instanceof BaseBluetoothException) {
          // eslint-disable-next-line no-console
          console.error('messagesConsumer', String(e));
        }
      });
  }, [actions, bluetoothState]);

  useEffect(() => {
    if (
      bluetoothState.connected &&
      !bluetoothState.eventListener.isListenerAdded
    ) {
      // add event listener to consume notifications
      // this is needed because new info to read will only
      // be broadcasted once a new Notification is consumed
      void bluetoothState.eventListener
        .startListening(messagesConsumer)
        .then(() =>
          send(RequestStatusMessage.createWithMessage(STATUS_ATTRIBUTES)),
        );
    }
  }, [bluetoothState, messagesConsumer, send]);

  useEffect(() => {
    if (!bluetoothState.connected) {
      actions.resetPaxState();
    }
  }, [actions, bluetoothState.connected]);

  if (!bluetoothState.connected) {
    return (
      <div className="mx-3 flex flex-grow justify-center">
        <Connect connect={bluetoothState.connect} />
      </div>
    );
  }

  const shownSetPoint = setPointRaw ?? state.heaterSetPointRaw;
  const selectedThemeIndex =
    state.uiMode === 0
      ? 0
      : hardcodedThemes.findIndex(theme =>
          isEqual(theme.theme, state.colorTheme),
        );
  const nameError = name ? deviceNameError(name) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 self-center p-4">
      <TemperatureProgress
        connected={bluetoothState.connected}
        heaterSetPointTemperature={rawToUnit(state.heaterSetPointRaw, unit)}
        actualTemperature={rawToUnit(state.actualTemperatureRaw, unit)}
        minTemperature={rawToUnit(PAX3_RAW_MIN, unit)}
        maxTemperature={rawToUnit(PAX3_RAW_MAX, unit)}
        unit={unit}
      />
      <HeaterStatus heaterStatus={state.heatingSate} />

      <Setting label={`Temperature: ${rawToUnit(shownSetPoint, unit)}°${unit}`}>
        <div className="flex items-center gap-3">
          <Slider
            min={PAX3_RAW_MIN}
            max={PAX3_RAW_MAX}
            step={1}
            value={[shownSetPoint]}
            onValueChange={value => setSetPointRaw(value[0])}
            onValueCommit={value => {
              actions.setHeaterSetPointTemperature(value[0]);
              setSetPointRaw(undefined);
              void send(HeaterSetPointMessage.createWithRaw(value[0]));
            }}
          />
          <Button
            variant="outline"
            onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
          >
            °{unit === 'C' ? 'F' : 'C'}
          </Button>
        </div>
      </Setting>

      <Setting label="Heating mode">
        <div className="flex flex-wrap gap-2">
          {DYNAMIC_MODES.map(([mode, label]) => (
            <Button
              key={mode}
              variant={state.dynamicMode === mode ? 'default' : 'secondary'}
              onClick={() => {
                actions.setFields({ dynamicMode: mode });
                void send(...buildDynamicModeMessages(mode));
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </Setting>

      <Setting label="LED brightness">
        <Slider
          max={1}
          step={0.05}
          value={[state.brightness ?? 0]}
          onValueChange={value => actions.setBrightness(value[0])}
          onValueCommit={value =>
            void send(BrightnessMessage.createWithBrightness(value[0]))
          }
        />
      </Setting>

      <Setting label="Vibration">
        <Slider
          max={1}
          step={0.05}
          value={[state.haptics ?? 0]}
          onValueChange={value => actions.setHaptics(value[0])}
          onValueCommit={value =>
            void send(HapticsMessage.createWithHaptics(value[0]))
          }
        />
      </Setting>

      <Setting label="LED color theme">
        <ThemePicker
          colorThemes={hardcodedThemes}
          selectedThemeIndex={selectedThemeIndex}
          onClick={(selectedTheme: ColorTheme) => {
            // The official app restores the default LEDs with UI mode 0
            // instead of writing a color theme.
            const isDefault = selectedTheme === hardcodedThemes[0].theme;
            actions.setColorTheme(selectedTheme);
            actions.setFields({ uiMode: isDefault ? 0 : 1 });
            void send(
              isDefault
                ? BytesMessage.create(Messages.ATTRIBUTE_UI_MODE, [0])
                : ColorThemeMessage.createWithTheme(selectedTheme),
            );
          }}
        />
      </Setting>

      <Setting label="Games">
        <div className="flex flex-wrap gap-2">
          {GAMES.map(([game, label]) => (
            <Button
              key={game}
              variant={state.gameMode === game ? 'default' : 'secondary'}
              onClick={() => {
                actions.setFields({ gameMode: game });
                void send(
                  BytesMessage.create(Messages.ATTRIBUTE_GAME_MODE, [game]),
                );
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </Setting>

      <Setting label="Lock">
        <Button
          variant={state.isLocked ? 'default' : 'secondary'}
          onClick={() => {
            const isLocked = !state.isLocked;
            actions.setFields({ isLocked });
            void send(
              BytesMessage.create(Messages.ATTRIBUTE_LOCKED, [
                isLocked ? 1 : 0,
              ]),
            );
          }}
        >
          {state.isLocked ? 'Locked, tap to unlock' : 'Unlocked, tap to lock'}
        </Button>
      </Setting>

      <Setting label={`Name${state.deviceName ? `: ${state.deviceName}` : ''}`}>
        <form
          className="flex gap-2"
          onSubmit={event => {
            event.preventDefault();
            actions.setFields({ deviceName: name });
            void send(DeviceNameMessage.createWithName(name));
            setName('');
          }}
        >
          <Input
            value={name}
            maxLength={15}
            placeholder="New name"
            onChange={event => setName(event.target.value)}
          />
          <Button type="submit" disabled={!name || !!nameError}>
            Rename
          </Button>
        </form>
        {nameError && <p className="text-sm text-red-500">{nameError}</p>}
      </Setting>

      <Button onClick={bluetoothState.disconnect} variant="secondary">
        Disconnect
      </Button>
    </div>
  );
};
