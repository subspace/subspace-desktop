import { createMachine } from 'xstate';

const stateMachine = createMachine({
  id: 'appState',
  initial: 'inital',
  context: {
    // consider adding 
  },
  states: {
    initial: {
      on: {
        START: 'syncing',
      },
    },
    syncing: {
      invoke: {
        id: 'startSyncing',
        // TODO: call start syncing on client
        src: Promise.resolve,
        onDone: {
          target: 'farming',
        },
        onError: 'syncingError',
      },
    },
    syncingError: {
      on: { 
        // alternatively RESUME
        RETRY_SYNCING: 'syncing',
      },
    },
    farming: {
      invoke: {
        id: 'startFarming',
        // TODO: call start farming on client
        src: Promise.resolve,
        onError: 'farmingError',
      }
    },
    farmingError: {
      on: {
        // alternatively RESUME
        RETRY_FARMING: 'farming',
      }
    },
    // When app is restarted it starts local node and UI creates connection to it
    connecting: {
      invoke: {
        id: 'connectingToNode',
        // TODO: call connect to node
        src: Promise.resolve,
        onError: 'connectingError',
        onDone: 'syncing',
      }
    }
  }
});
