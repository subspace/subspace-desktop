import { createMachine, assign } from "xstate";

import client from '../client';
import { SyncState } from '../types';

interface SyncContext {
  isSyncing: boolean;
  syncState?: SyncState;
  // error?: string;
}

type SyncData = {
  isSyncing: boolean;
  syncState: SyncState;
}

const isSyncing = (ctx: SyncContext) => ctx.isSyncing;

const getSyncData = async (): Promise<SyncData> => {
  const isSyncing = await client.isSyncing();
  const syncState = (await client.getSyncState()).toJSON() as unknown as SyncState;
  return { isSyncing, syncState }
};

// TODO: add error handling
const syncMachine = createMachine<SyncContext>(
  {
    id: "syncMachine",
    context: {
      isSyncing: false,
      syncState: undefined,
      // error: undefined
    },
    initial: "syncing",
    states: {
      syncing: {
        entry: () => console.log('syncMachine: syncing'),
        invoke: {
          id: "getSyncData",
          src: getSyncData,
          onDone: {
            target: 'waiting',
            // event.data is: { isSyncing, syncState }
            actions: assign((_, { data }) => data)
          },
          // onError: 
        },
      },
      waiting: {
        entry: (ctx) => console.log('syncMachine: waiting', ctx),
        after: {
          SYNC_DELAY: [
            {
              target: "syncing",
              cond: isSyncing,
            },
            {
              target: "done",
            },
          ]
        },
      },
      done: {
        type: 'final'
      }
    },
  },
  {
    delays: {
      SYNC_DELAY: 3000,
    }
  }
);

export default syncMachine;
