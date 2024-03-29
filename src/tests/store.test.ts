import { setActivePinia, createPinia } from 'pinia';

import {
  useStore,
  INITIAL_PLOT_DIR,
  INITIAL_PLOT_SIZE,
  INITIAL_SYNC_STATE,
  INITIAL_STATUS,
} from '../stores/store';
import { SyncState } from '../lib/types';
import {
  blockStorageMock,
  configClassMock,
  FarmedBlockMock,
  configFileMock,
  clientMock,
  tauriInvokerMock,
} from '../mocks';
import Config from '../lib/config';
import { Client } from '../lib/client';

describe('Store', () => {
  beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  it('setPlotPath action should update directory', () => {
    const expected = '/random_dir';
    const store = useStore();
    expect(store.plotPath).toBe(INITIAL_PLOT_DIR);
    store.setPlotPath(expected);
    expect(store.plotPath).toBe(expected);
  });

  it('setPlotSize action should update plot size', () => {
    const expected = 60;
    const store = useStore();
    expect(store.plotSizeGB).toBe(INITIAL_PLOT_SIZE);
    store.setPlotSize(expected);
    expect(store.plotSizeGB).toBe(expected);
  });

  it('setSyncState action should update syncState', () => {
    const expected: SyncState = {
      currentBlock: 12,
      startingBlock: 0,
      highestBlock: 60,
    };
    const store = useStore();
    expect(store.syncState).toEqual(INITIAL_SYNC_STATE);
    store.setSyncState(expected);
    expect(store.syncState).toEqual(expected);
  });

  it('setPeers action should update peers', () => {
    const expected = 50;
    const store = useStore();
    expect(store.network.peers).toBe(0);
    store.setPeers(expected);
    expect(store.network.peers).toBe(expected);
  });

  it('setStatus action should update status', () => {
    const expected = 'syncing';
    const store = useStore();
    expect(store.status).toBe(INITIAL_STATUS);
    store.setStatus(expected);
    expect(store.status).toBe(expected);
  });

  it('setRewardAddress action should update reward address', () => {
    const expected = 'random reward address';
    const store = useStore();
    expect(store.rewardAddress).toBe('');
    store.setRewardAddress(expected);
    expect(store.rewardAddress).toBe(expected);
  });

  it('updateBlockNum action should update network.syncedAtNum property', () => {
    const expected = 10;
    const store = useStore();
    expect(store.network.syncedAtNum).toBe(0);
    store.updateBlockNum(expected);
    expect(store.network.syncedAtNum).toBe(expected);
  });

  it('setNodeName action should update node name', async () => {
    const expected = 'random node name';
    const store = useStore();
    expect(store.nodeName).toBe('');
    await store.setNodeName(configClassMock, expected);
    expect(store.nodeName).toBe(expected);
  });

  it('setNodeName action should set error if config update fails', async () => {
    const errorMessage = 'random error message';
    const config = {
      ...configClassMock,
      update() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Config;

    const store = useStore();

    expect(store.error).toEqual({
      title: '',
      message: '',
    });

    await store.setNodeName(config, 'random node name');

    expect(store.error).toEqual({
      title: 'errorPage.configUpdateFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('addFarmedBlock action should update farmed blocks', () => {
    const store = useStore();
    expect(store.farmedBlocks).toEqual([]);
    store.addFarmedBlock(blockStorageMock, FarmedBlockMock);
    expect(store.farmedBlocks).toEqual([
      FarmedBlockMock
    ]);
  });

  it('updateFromConfig action should populate store with values from config', async () => {
    const store = useStore();

    expect(store.plotSizeGB).toBe(INITIAL_PLOT_SIZE);
    expect(store.plotPath).toBe(INITIAL_PLOT_DIR);
    expect(store.nodeName).toBe('');
    expect(store.rewardAddress).toBe('');

    await store.updateFromConfig(blockStorageMock, configClassMock);

    expect(store.plotSizeGB).toBe(configFileMock.plot.sizeGB);
    expect(store.plotPath).toBe(configFileMock.plot.location);
    expect(store.nodeName).toBe(configFileMock.nodeName);
    expect(store.rewardAddress).toBe(configFileMock.rewardAddress);

    // TODO: we plan to replace local storage - add assertion for farmed blocks if still relevant
  });

  it('updateFromConfig action should set error if config read fails', async () => {
    const error = new Error('random error message');
    const store = useStore();

    const config = {
      ...configClassMock,
      readConfigFile() {
        return Promise.reject(error);
      }
    } as unknown as Config;

    await store.updateFromConfig(blockStorageMock, config);

    expect(store.error).toEqual({
      title: 'errorPage.configReadFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('startNode action should update status and call start node client method', async () => {
    const store = useStore();

    const setStatusSpy = jest.spyOn(store, 'setStatus');

    expect(store.status).toBe(INITIAL_STATUS);

    store.setNodeName(configClassMock, 'random node name');
    store.setPlotPath('/random-dir');

    await store.startNode(clientMock, tauriInvokerMock);

    // TODO: this method should update status only once:
    // expect(store.status).toBe('startingNode');
    // fix after retry workaround is removed from store.startFarming
    expect(setStatusSpy).toHaveBeenNthCalledWith(1, 'startingNode');
    expect(setStatusSpy).toHaveBeenNthCalledWith(2, 'syncing');
    expect(clientMock.startNode).toHaveBeenCalled();
  });

  it('startNode action should set error state if client method throws error', async () => {
    const errorMessage = 'random error message';

    const store = useStore();

    store.setNodeName(configClassMock, 'random node name');
    store.setPlotPath('/random-dir');

    const client = {
      ...clientMock,
      startNode() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Client;

    await store.startNode(client, tauriInvokerMock);

    expect(store.error).toEqual({
      title: 'errorPage.startNodeFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('startNode action should set error state if node name and plot directory are not set before', async () => {
    const errorMessage = 'errorPage.startNodeMissingParams';

    const store = useStore();

    const client = {
      ...clientMock,
      startNode() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Client;

    await store.startNode(client, tauriInvokerMock);

    expect(store.error).toEqual({
      title: 'errorPage.startNodeFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('startFarmer action should update statuses and call relevant client methods', async () => {
    const plotPath = '/random_dir';
    const plotSize = 100;
    const store = useStore();
    const setStatusSpy = jest.spyOn(store, 'setStatus');

    expect(store.status).toBe(INITIAL_STATUS);

    store.setPlotPath(plotPath);
    store.setPlotSize(plotSize);

    await store.startFarmer(clientMock, tauriInvokerMock, blockStorageMock);

    // TODO: this method should update status twice: first syncing, then farming
    // expect(setStatusSpy).toHaveBeenNthCalledWith(1, 'syncing');
    // expect(setStatusSpy).toHaveBeenNthCalledWith(2, 'farming');
    // fix after retry workaround is removed from store.startFarming
    expect(setStatusSpy).toHaveBeenNthCalledWith(1, 'farming');

    expect(clientMock.startFarming).toHaveBeenCalledWith(plotPath, plotSize);
    expect(clientMock.getSyncState).toHaveBeenCalled();
    expect(clientMock.isSyncing).toHaveBeenCalled();
    expect(clientMock.startSubscription).toHaveBeenCalled();

    // TODO: If relevant add assertions for Plot and Network statuses after Dashboard Plot component #294 is resolved
  });

  it('startFarmer action should set error if client.startFarming throws error', async () => {
    const errorMessage = 'random error message';
    const client = {
      ...clientMock,
      startFarming() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Client;

    const store = useStore();

    await store.startFarmer(client, tauriInvokerMock, blockStorageMock);

    expect(store.error).toEqual({
      title: 'errorPage.startFarmerFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('startFarmer action should set error if client.getSyncState throws error', async () => {
    const errorMessage = 'random error message';
    const client = {
      ...clientMock,
      getSyncState() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Client;

    const store = useStore();

    await store.startFarmer(client, tauriInvokerMock, blockStorageMock);

    expect(store.error).toEqual({
      title: 'errorPage.startFarmerFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('startFarmer action should set error if client.isSyncing throws error', async () => {
    const errorMessage = 'random error message';
    const client = {
      ...clientMock,
      isSyncing() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Client;

    const store = useStore();

    await store.startFarmer(client, tauriInvokerMock, blockStorageMock);

    expect(store.error).toEqual({
      title: 'errorPage.startFarmerFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('startFarmer action should set error if client.startSubscription throws error', async () => {
    const errorMessage = 'random error message';
    const client = {
      ...clientMock,
      startSubscription() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Client;

    const store = useStore();

    await store.startFarmer(client, tauriInvokerMock, blockStorageMock);

    expect(store.error).toEqual({
      title: 'errorPage.startFarmerFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });

  it('confirmPlottingSetup action should call config update method', async () => {
    const plotSize = 10;
    const plotPath = '/random_dir';
    const rewardAddress = 'random address';
    const nodeName = 'random generated name';

    const store = useStore();
    store.setPlotSize(plotSize);
    store.setPlotPath(plotPath);
    store.setRewardAddress(rewardAddress);

    await store.confirmPlottingSetup(configClassMock, nodeName);

    // first node name is set (separate method which is also used elsewhere)
    expect(configClassMock.update).toHaveBeenNthCalledWith(1, {
      nodeName,
    });

    // then set plot and reward address
    expect(configClassMock.update).toHaveBeenLastCalledWith({
      plot: {
        location: plotPath,
        sizeGB: plotSize,
      },
      rewardAddress,
    });
  });

  it('confirmPlottingSetup action should set error if config update fails', async () => {
    const errorMessage = 'random error message';
    const store = useStore();
    const config = {
      ...configClassMock,
      update() {
        return Promise.reject(errorMessage);
      }
    } as unknown as Config;

    await store.confirmPlottingSetup(config, 'random generated name');

    expect(store.error).toEqual({
      title: 'errorPage.configUpdateFailed',
      // TODO: replace default error message with specific one
      message: 'errorPage.defaultErrorMessage',
    });
  });
});
