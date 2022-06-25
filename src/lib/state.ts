import { createMachine } from 'xstate';

import client from './client';
import { SyncState } from './types';
import * as util from "./util";

export interface StateContext {
  // rewardAddress: string;
  nodeName: string;
  syncState: SyncState;
  isSyncing: boolean;
}

const context = {
  // rewardAddress: '',
  nodeName: '',
  isSyncing: false,
  syncState: {
    startingBlock: 0,
    currentBlock: 0,
    highestBlock: 0,
  },
  // consider adding: 
  // locale
  // isFirstLoad + setFirstLoad method,
  // farmed blocks,
  // peers: 0,
}

// TODO: make TS happy
// TODO: handle error when starting node (transition to 'startNodeError')
async function startNode(context: StateContext, event: any) {
  if (event.nodeName !== "") {
    return client.startNode(event.location, event.nodeName);
  } else {
    util.errorLogger("DASHBOARD | node name was empty when tried to start node")
  }
}

async function syncService() {
  return new Promise((resolve) => setTimeout(resolve, 7000));
}

async function farmService() {
  return new Promise((resolve) => setTimeout(resolve, 7000));
}

const stateMachine = createMachine({
  id: 'appState',
  initial: 'initial',
  context,
  // TODO: make TS happy
  schema: { context: {} as any },
  states: {
    initial: {
      on: {
        // start from scratch
        SETUP_PLOT: 'syncing',
        // restart
        START_NODE: 'connecting',
      },
    },
    // When app is restarted it starts local node and UI creates connection to it
    connecting: {
      invoke: {
        id: 'startNode',
        src: startNode,
        onError: {
          target: 'startNodeError',
          // TODO: test errors
          actions: (_, event) => console.log(event.data),
        },
        onDone: {
          target: 'syncing',
          actions: () => console.log('NODE STARTED > SYNCING'),
        },
      }
    },
    syncing: {
      invoke: {
        id: 'syncService',
        // TODO: has to be syncing state machine
        src: syncService,
        onError: {
          target: 'syncingError',
          // TODO: handle errors
          actions: (_, event) => console.log(event.data),
        },
        onDone: {
          target: 'farming',
          actions: () => console.log('NODE SYNCED > FARMING'),
        },
      }
    },
    syncingError: {
      on: {
        // alternatively RESUME
        RETRY_SYNCING: 'syncing',
      },
    },
    farming: {
      invoke: {
        id: 'farmService',
        // TODO: has to be farming state machine
        src: farmService,
        onError: {
          target: 'farmingError',
          // TODO: handle errors
          actions: (_, event) => console.log(event.data),
        },
      },
      type: 'final',
    },
    farmingError: {
      on: {
        // alternatively RESUME
        RETRY_FARMING: 'farming',
      }
    },
    startNodeError: {
      on: {
        RETRY_CONNECTING: 'connecting',
      }
    }
  }
})

export default stateMachine;
