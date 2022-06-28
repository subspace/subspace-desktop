# Subspace Desktop

Standalone Desktop application for farming on Subspace Network (includes both node and farmer).
Download and run this application to be a farmer on Subspace Network (currently on testnet).

# OS Requirements
Below is not necessarily strict boundaries, but rather what we have tested and confirmed so far.

- Windows 10 and 11
- Ubuntu 20.04 and 22.04
- macOS 11 and 12

# GPU support
If you want to utilize your GPU for faster plotting, you need to have OpenCL drivers installed. We currently support AMD, NVIDIA, and Intel GPUs.

TODO: add specific explanation for Windows/Ubuntu and MacOS, this will be added after I clarify everything with Nazar


# How to Install

1. Download the latest [release](https://github.com/subspace/subspace-desktop/releases) for your preferred platform.
2. Install the program.
3. Open `subspace-desktop` application.
4. Click the `This is my first time farming` option (or, if you want to use an existing reward address, click `I've run a farmer before and still have my keys`).
5. Select how much space you want to pledge
6. When you click `start plotting`, it may prompt you to store your seed phrase, if you did not import a reward address.
7. The network will begin to sync and plotting will start. While you wait you can click `hints` to open up the `what is plotting` page, and join our online communities from the social links displayed in there!
8. Once the node fully syncs you will be taken the the Farmer Dashboard which will show you the network/plot status, and your total earned rewards.

# How to Upgrade

## Upgrade from previous version of Subspace Desktop

1. Simply uninstall the old application from your computer
2. Download the latest [release](https://github.com/subspace/subspace-desktop/releases) for your preferred platform (make sure to select "Latest" release with green label and not "Pre-release")
3. Install new version of Subspace Desktop
4. Run the application, it should detect your old plot and continue farming as usual

**UNLESS STATED OTHERWISE IN THE RELEASE NOTES:**
- You don't need to delete your existing plot
- You don't need to create a new identity
- You don't need to delete the config and log files

## Upgrade from CLI (subspace-node + subspace-farmer)

These instructions are for upgrading installation that followed [official guide](https://github.com/subspace/subspace/blob/main/docs/farming.md),
if you followed unofficial one, ask guide author for proper upgrade steps.

1. Remove old data to free space used by CLI:
    ```bash
    # Replace `FARMER_FILE_NAME` with the name of the node file you downloaded from releases
    ./FARMER_FILE_NAME wipe
    # Replace `NODE_FILE_NAME` with the name of the node file you downloaded from releases
    ./NODE_FILE_NAME purge-chain --chain testnet
    ```
   Make sure to replace `FARMER_FILE_NAME` and `NODE_FILE_NAME` with actual file names
2. Delete those files `FARMER_FILE_NAME` and `NODE_FILE_NAME`
3. Install Subspace Desktop
4. Choose `I've run a farmer before and still have my keys` on the first screen and use the same reward address (that you used for CLI) there

# Development

## Prerequisites

- nodejs 14+
- yarn
- rustc

### Linux

On Linux you'll have to install development version of `libwebkit2gtk-4.0` and `libappindicator` packages, which can be done on Ubuntu with:

```bash
sudo apt update && sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libappindicator3-dev \
    patchelf \
    librsvg2-dev
```

- libappindicator: needed to use the system tray feature.
- patchelf and librsvg: needed to bundle AppImage.

Stuck?

https://tauri.studio/en/docs/getting-started/intro

## Install the dependencies

```bash
yarn
```

### Start the app in development mode

Terminal 1

```bash
yarn quasar dev
```

Terminal 2

```bash
yarn tauri dev
```

### Build the app for production (Builds Quasar and Tauri)

```bash
yarn build
```

### Access Tauri or Quasar specific commands

```bash
yarn quasar --help
yarn tauri --help
```

### Customize Quasar config
<https://v2.quasar.dev/quasar-cli/quasar-conf-js>

### Customize Tauri config
<https://tauri.studio/en/docs/api/config>

### Contribute to development
Review the [ARCHITECTURE.md](./ARCHITECTURE.md) document for an overview of the application design.
