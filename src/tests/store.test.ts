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
  configMock, 
  FarmedBlockMock, 
  configMockData,
  clientMock,
  utilMock,
} from '../mocks';

describe('Store', () => {
  beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    setActivePinia(createPinia());
  });
  
  it('setPlotDir action should update directory', () => {
    const expected = '/random_dir';
    const store = useStore();
    expect(store.plotDir).toBe(INITIAL_PLOT_DIR);
    store.setPlotDir(expected);
    expect(store.plotDir).toBe(expected);
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
  
  it('setNodeName action should update node name', () => {
    const expected = 'random node name';
    const store = useStore();
    expect(store.nodeName).toBe('');
    store.setNodeName(configMock, expected);
    expect(store.nodeName).toBe(expected);
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
    expect(store.plotDir).toBe(INITIAL_PLOT_DIR);
    expect(store.nodeName).toBe('');
    expect(store.rewardAddress).toBe('');

    await store.updateFromConfig(blockStorageMock, configMock);

    expect(store.plotSizeGB).toBe(configMockData.plot.sizeGB);
    expect(store.plotDir).toBe(configMockData.plot.location);
    expect(store.nodeName).toBe(configMockData.nodeName);
    expect(store.rewardAddress).toBe(configMockData.rewardAddress);

    // TODO: we plan to replace local storage - add assertion for farmed blocks if still relevant
  });

  it('startNode action should update status and call start node client method', async () => {
    const store = useStore();

    expect(store.status).toBe(INITIAL_STATUS);

    store.setNodeName(configMock, 'random node name');
    store.setPlotDir('/random-dir');

    await store.startNode(clientMock, utilMock);

    expect(store.status).toBe('startingNode');
    expect(clientMock.startNode).toHaveBeenCalled();
  });

  // TODO: Implement error pages for potential worst case scenarios #253 
  it.todo('startNode action should set error state if client method throws error');
  it.todo('startNode action should set error state if node name and plot directory are not set before');

  it('startFarmer action should update statuses and call relevant client methods', async () => {
    const plotDir = '/random_dir';
    const plotSize = 100;
    const store = useStore();
    const setStatusSpy = jest.spyOn(store, 'setStatus');

    expect(store.status).toBe(INITIAL_STATUS);

    store.setPlotDir(plotDir);
    store.setPlotSize(plotSize);

    await store.startFarmer(clientMock, utilMock, blockStorageMock);

    // spy on status updates: first syncing, then farming
    expect(setStatusSpy).toHaveBeenNthCalledWith(1, 'syncing');
    expect(setStatusSpy).toHaveBeenNthCalledWith(2, 'farming');

    expect(clientMock.startFarming).toHaveBeenCalledWith(plotDir, plotSize);
    expect(clientMock.getSyncState).toHaveBeenCalled();
    expect(clientMock.isSyncing).toHaveBeenCalled();
    expect(clientMock.startSubscription).toHaveBeenCalled();
    
    // TODO: If relevant add assertions for Plot and Network statuses after Dashboard Plot component #294 is resolved
  });

  // TODO: Add tests when startFarmer fails within Implement error pages for potential worst case scenarios #253 
})
