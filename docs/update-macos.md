# Update Paseo from the fork on Apple Silicon

Use this on an M1/M2/M3/M4 Mac to build and replace Paseo locally, without a paid Apple developer account or downloading GitHub Actions artifacts.

## First-time setup

Install Git, Xcode Command Line Tools, and Node.js 26.12.1 or newer. For example, with Homebrew:

```bash
xcode-select --install  # only if the Command Line Tools are not installed
brew install node
export PATH="$(brew --prefix node)/bin:$PATH"
git clone https://github.com/infectiousstupidity/paseo.git
cd paseo
bash scripts/update-macos.sh
```

If you already have compatible Node.js on your PATH, skip the Homebrew step. Persist the PATH adjustment in your shell profile if you need it after reopening Terminal.

## Subsequent updates

```bash
cd ~/paseo
bash scripts/update-macos.sh
```

The script requires an ARM64 Mac, a clean `main` checkout and Node.js 26.12.1+. It fast-forward pulls `origin/main`, runs `npm ci`, builds an unpacked ARM64 `Paseo.app` with ad-hoc signing, and copies it to the install location. It then asks a running Paseo to quit, replaces the bundle, and reopens the application. The old app is restored if the file replacement or launch command fails.

It updates `/Applications/Paseo.app` if present; otherwise `~/Applications/Paseo.app` if present; otherwise it creates the latter. Updating `/Applications` may request an administrator password **only for the installation step**, not for npm or the build.

You can explicitly select an app location:

```bash
PASEO_APP_PATH=/Applications/Paseo.app bash scripts/update-macos.sh
```

Builds are stamped with `PASEO_LOCAL_BUILD_COMMIT` to prevent the upstream Paseo auto-updater from overwriting the fork. User data in `~/.paseo` and Electron's normal macOS application data folder is not touched. A failed pull or build leaves the installed app alone.

The local build uses ad-hoc signing and disables hardened runtime; this is intended for personal development installs, not trusted distribution. Because it is not notarized, macOS may require **System Settings → Privacy & Security → Open Anyway** the first time it runs. macOS Keychain may also prompt after locally signed updates. A successful `open` command does not guarantee the newly built application is free of runtime errors.
