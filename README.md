# PAX 3 Web

Control a PAX 3 vaporizer from the browser. You don't need the Android app,
an account or any install, and it works on any OS with Web Bluetooth.

**Use it:** https://290asd.github.io/pax3-web/

It offers the same settings as the official Android app:

- Temperature, in °C or °F
- Heating mode: Standard, Boost, Efficiency, Stealth or Flavor
- LED brightness, vibration strength and LED color theme
- Lock and unlock
- Device name
- The built-in games: PAX Run, PAX Says and PAX Spin
- Live temperature, heating state, battery and charging

PAX shut down their own web app in 2026. This project is a fork of
[evertonstz/pax-romana](https://github.com/evertonstz/pax-romana), which did
the original encryption work.

## Requirements

| Platform | Browser |
| --- | --- |
| Windows, macOS, Linux, ChromeOS | Chrome or Edge |
| Android | Chrome |
| iOS / iPadOS | Bluefy browser (Safari has no Web Bluetooth) |

Tested on a real PAX 3 on Windows and iOS.

Firefox does not support Web Bluetooth. On Linux you may need to enable
`chrome://flags/#enable-experimental-web-platform-features`.

## Usage

1. Find the 8-character **serial number** on the back of your PAX 3. The
   device uses it as its encryption key, and browsers are not allowed to read
   it over Bluetooth.
2. Add the serial in the app.
3. Shake the PAX until the LEDs pulse blue (pairing mode), then click
   **Connect** and pick the device.

## Development

```sh
corepack enable
pnpm install
pnpm dev      # http://localhost:5173/pax3-web/
pnpm test
pnpm lint
```

- `src/pax/`: the protocol (encryption, messages, PAX 3 temperature math)
- `src/hooks/usePaxBluetoothServices/`: the Web Bluetooth transport
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md): the full reverse-engineered
  protocol, including attributes that are not wired up yet. Start here if you
  want to add features or write a client in another language.

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Not supported

- **Firmware updates.** The firmware files lived on PAX servers, which are
  gone, and a failed update can brick the device.
- **Usage history and logs.**
- **PAX Era, Era Pro and pods.** The protocol is similar, and pull requests are welcome.

## Disclaimer

This is an unofficial project. It is not affiliated with or endorsed by PAX
Labs, Inc. "PAX" is their trademark. Use it at your own risk.
