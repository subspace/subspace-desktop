import { store } from 'quasar/wrappers';
import { createPinia } from 'pinia';

export default store(async () => {
  const pinia = createPinia();
  return pinia
})
