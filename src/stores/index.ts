import { store } from 'quasar/wrappers';
import { createPinia } from 'pinia';

import { Client } from "../lib/client"
import { createApi } from '../lib/util';

const LOCAL_RPC = process.env.LOCAL_API_WS || "ws://localhost:9947";

declare module 'pinia' {
  export interface PiniaCustomProperties {
    client: Client,
  }
}

export default store(async () => {
  const pinia = createPinia();
  const api = createApi(LOCAL_RPC);
  const client = new Client(api);

  pinia.use(() => ({ client }));

  return pinia
})
