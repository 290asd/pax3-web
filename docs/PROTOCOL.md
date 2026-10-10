# PAX 3 Bluetooth LE protocol

Notes for anyone building their own PAX 3 client. The protocol was worked out
for interoperability from the official Android app (`com.pax.app` 3.0.3, its
BLE library is `com.pax.peace`) and cross-checked against the retired PAX web
app and [pax-romana](https://github.com/evertonstz/pax-romana). No PAX code is
included in this repository. Everything below is described in our own words.

All multi-byte integers are little-endian.

## GATT

| UUID | What |
| --- | --- |
| `8e320200-64d2-11e6-bdf4-0800200c9a66` | PAX service (advertised, use it as the scan filter) |
| `8e320201-…` | Read: the next pending message (encrypted) |
| `8e320202-…` | Write: commands (encrypted). The official app writes **with response** |
| `8e320203-…` | Notify: "a message is ready, read 0201" |
| `0000180a-0000-1000-8000-00805f9b34fb` | Device Information. The serial-number characteristic `2a25` is blocked in Web Bluetooth |
| `64f50300-efdc-11e6-bc64-92361f002671` | Usage log service (not implemented here) |
| `00001530-1212-efde-1523-785feabcd123` | Nordic legacy DFU, firmware updates (not implemented) |

Using `writeValueWithoutResponse` on `0202` works on macOS but is rejected on
Windows and Linux. Use a write with response.

## Encryption

Every payload is AES-128 encrypted, both read and write.

1. `serial` = the 8-character serial number (ASCII), printed on the back of the device.
2. `key = AES-ECB(F7C866C38F78753086293BD57DD32540, serial ‖ serial)`, a single 16-byte block.
3. Packet on the wire = `AES-OFB(key, iv, plaintext) ‖ iv`, where `iv` is 16 random bytes.
4. Before encrypting a write, pad the plaintext with **random** bytes up to a whole number of 16-byte blocks.

Decrypting: the last 16 bytes are the IV and everything before them is the ciphertext.

Test vector: serial `KRZQ2NW9` gives key `8423398c3781fa6b008cba8c6c5366d4`.

## Messages

Plaintext layout: `[attribute id, payload…, random padding]`.

### Connection flow

1. Connect, then start notifications on `0203`.
2. Write a `STATUS_UPDATE` (254) request. Its payload is a uint64 bitmask of the
   attributes you want (`1 << id`). The official app requests 2, 3, 6, 7, 9, 13,
   15, 17, 19, 20, 21, 23, 27 and 28.
3. For every notification, read `0201`, decrypt it and dispatch on byte 0. The
   device also pushes changes on its own (temperature, heating state, battery
   and so on).

### Attributes

| ID | Name | Dir | Payload |
| --- | --- | --- | --- |
| 1 | TEMPERATURE | R | uint16 raw temperature (see below) |
| 2 | HEATER_SET_POINT | R/W | uint16 raw. The app writes it as an int32 |
| 3 | BATTERY | R | uint8 percent |
| 6 | IS_LOCKED | R/W | uint8 0/1. A locked device will not heat |
| 7 | CHARGE_STATUS | R | uint8, bit 0 = charger connected, bit 4 = charging complete |
| 9 | TIME | R | uint32 |
| 10 | NAME | R/W | uint8 length + ASCII, max 15 chars, not blank, must not start with `dfu_` |
| 13 | START_REPLAY | | Era only |
| 15 | GAME_MODE | R/W | uint8: 0 none, 1 PAX Run, 2 PAX Says, 3 PAX Spin |
| 17 | HEATER_RANGES | R | 5+ uint16 values `v0…v4`: four "petal" ranges `[v0,v1] … [v3,v4]` |
| 19 | DYNAMIC_MODE | R/W | uint8: 0 Standard, 1 Boost, 2 Efficiency, 3 Stealth, 4 Flavor |
| 20 | COLOR_THEME | R/W | uint8 count + count × 8-byte color states |
| 21 | BRIGHTNESS | R/W | Write: `[value, type]`. Read: uint8 value |
| 23 | HAPTIC_MODE | R/W | Write: `[amplitude 0–128, 0]`. Read: amplitude plus profile bytes |
| 25 | HEATING_PARAMETERS | W | 11 × uint16, see dynamic modes |
| 26 | DFU_MODE | W | `[1]` reboots into the bootloader. **Do not send** unless you are flashing firmware |
| 27 | UI_MODE | R/W | uint8: 0 normal, 1 custom color, 2 temp-to-color, 3 usage |
| 28 | SHELL_COLOR | R | device color, cosmetic |
| 30 | LOW_SOC_MODE_STATUS | R | bool |
| 31 | ACTIVE_TARGET_TEMPERATURE | R | uint16 raw (includes boost, ramping and so on) |
| 32 | HEATING_STATE | R | uint8: 0 heating, 1 ready, 2 lip-sense boost, 3 lip-sense cool-down, 4 motion standby, 5 oven off, 6 temp-set mode |
| 254 | STATUS_UPDATE | W | uint64 bitmask, see above |

Other IDs exist in the app (`USAGE` 4, `USAGE_LIMIT` 5, `POD_INSERTED` 8,
`EEPROM` 11, `LOG` 12, `RESET` 14, `SESSION_TIMEOUT` 16, `LOG_SYNC_REQUEST` 18,
`USAGE_DISPLAY` 22, `SUPPORTED_ATTRIBUTES` 24, `ENTER_EXIT_OVEN_OFF` 29,
`CLEAR_LOGS` 33, `LOG_CLEAR_COMPLETE` 34, `HAPTICS` 40). The PAX 3 screens of
the official app do not use them.

### Temperature

PAX 3 does **not** use °C × 10. The official app (and the retired web app)
convert between display units and raw values with these formulas. All
divisions are integer divisions.

```
°C  = raw < 1980 ? (raw + 4) * 10 / 109 + 3 : raw / 12 + 20
raw = °C < 185  ? (°C - 3) * 109 / 10 + 6  : (°C - 20) * 12 + 10
°F  = raw < 1986 ? raw * 6 / 37 + 38       : raw / 6 + 29
```

The temperature slider covers raw 1870–2350, which is about 175–215 °C or 341–420 °F.

### Brightness

The official app maps 0–100 % to the raw range 5–128 on PAX 3. The second
payload byte is the command type:

* `0`: set brightness
* `1`: temporary override (Stealth mode sends `[30, 1]`)
* `2`: clear the override (`[0, 2]`)

### Dynamic modes

Choosing a mode in the official app sends three writes, in this order:

1. `DYNAMIC_MODE [mode]`
2. `HEATING_PARAMETERS` with the profile below
3. `BRIGHTNESS`: `[30, 1]` for Stealth, `[0, 2]` for every other mode

Profile fields, in order: standby temperature, no-motion-to-standby time,
no-lip cool-down temperature change, no-lip cool-down start, no-lip cool-down
rate, no-lip power-off time, boost temperature change, ramp target
temperature, ramp starting temperature, ramp rate, option flags (1 heater
enabled, 2 standby, 4 no-lip cooling, 8 no-lip shutdown, 16 lip boost,
32 custom temperature, 64 ramping, 128 ramp continue).

| Mode | Profile |
| --- | --- |
| 0 Standard | 1600, 30, 150, 20, 30, 180, 39, 2300, 1990, 20, 63 |
| 1 Boost | 1750, 60, 70, 30, 20, 180, 112, 2300, 1990, 20, 63 |
| 2 Efficiency | 1600, 30, 150, 20, 30, 180, 39, 2350, 2050, 20, 95 |
| 3 Stealth | 1200, 15, 300, 9, 100, 180, 0, 2300, 2040, 20, 63 |
| 4 Flavor | 1600, 15, 100, 10, 100, 180, 84, 2300, 2040, 20, 63 |

### Color themes

A color state is 8 bytes: `r1 g1 b1 r2 g2 b2 animation frequency`. PAX 3
themes contain 4 states in this order: startup, heating, regulating, standby.
The preset themes in the app (Ocean, Sunset, Mars) are in
`src/components/ThemePicker/colors.ts`. "Default" is not a color theme: the
app restores the stock LEDs by writing `UI_MODE [0]`.

## Advertisement

The scan record's manufacturer-specific data is not keyed by a real company ID.

* **Company ID field:** used as a bitfield. Bit 0 = shaken, bits 1–3 = model
  (1 Era, 2 PAX 3), bit 5 = request connection, bit 6 = low battery, bits 7–10
  = heating state.
* **Data bytes 0–7:** the serial number in ASCII.
* **PAX 3, last 5 bytes:** packed 12-bit fields for temperature (bits 0–10),
  target temperature (bits 12–23) and set point (bits 24–35).

Web Bluetooth only exposes advertisement data through the experimental
`watchAdvertisements()`. For that reason this app asks for the serial
instead, just like the official web app did.

## Not covered

* **Firmware updates.** Nordic legacy DFU. The firmware images were downloaded
  from PAX servers, which no longer exist.
* **Usage log sync.** Service `64f50300-…`, with event types such as puff,
  charger, lock and so on.
* **The hidden "secret" menu.** It only contains developer screens (logo
  animation, session progress, bottom-sheet demo and a log viewer) and does
  not configure the device.
