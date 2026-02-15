import { INITIAL_PRODUCTS, INITIAL_ORDERS } from './mockData';

export const apiService = {
  getProducts: () => Promise.resolve(INITIAL_PRODUCTS),
  getOrders: () => Promise.resolve(INITIAL_ORDERS),
  // When backend is ready, change to: return axios.get('/products')
};