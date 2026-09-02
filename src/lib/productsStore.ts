/**
 * Products and services that can be added to a document.
 *
 * Rows in Postgres now; this used to be a localStorage array seeded with three
 * placeholder products priced in dollars.
 */

import { createCache } from "./collectionCache";
import { ProductRepo } from "./accountingRepo";

export type Product = { id: string; name: string; price: number; description?: string };

export const productsCache = createCache<Product>(() => ProductRepo.list());

export const ProductsStore = {
  list(): Product[] {
    return productsCache.list();
  },
  load(): Promise<Product[]> {
    return productsCache.ensureLoaded();
  },
  async upsert(p: Product): Promise<Product> {
    await productsCache.mutate(() => ProductRepo.upsert(p));
    return p;
  },
  async remove(id: string): Promise<void> {
    await productsCache.mutate(() => ProductRepo.remove(id));
  },
};