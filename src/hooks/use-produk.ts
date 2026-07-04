import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Produk, Kategori } from '../types';

/**
 * Custom hook to manage products and categories.
 * Provides functions to fetch items, save/update photo embeddings, and load from offline caches.
 */
export function useProduk() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('kategori')
        .select('*')
        .eq('aktif', true);

      if (catError) throw catError;
      const categories: Kategori[] = catData || [];
      setKategoriList(categories);
      localStorage.setItem('tokiva_kategori_cache', JSON.stringify(categories));

      // 2. Fetch products (with relational category data)
      const { data: prodData, error: prodError } = await supabase
        .from('produk')
        .select('*, kategori:kategori_id(*)');

      if (prodError) throw prodError;
      
      const products: Produk[] = (prodData || []).filter(p => p.is_aktif);
      setProdukList(products);
      localStorage.setItem('tokiva_produk_cache', JSON.stringify(products));
    } catch (err: any) {
      const errorMessage = err.message || err.description || (err instanceof Error ? err.toString() : JSON.stringify(err));
      console.error('Error fetching products/categories from Supabase:', errorMessage, err);
      
      let clientError = 'Failed to fetch database records';
      if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-project')) {
        clientError = 'Supabase credentials are still using template/placeholder values in .env! Please update your .env file with actual project credentials and restart the dev server.';
      } else if (err.message) {
        clientError = err.message;
      }
      setError(clientError);
      
      // Fallback to offline localStorage cache
      const cachedProd = localStorage.getItem('tokiva_produk_cache');
      const cachedCat = localStorage.getItem('tokiva_kategori_cache');
      if (cachedProd) setProdukList(JSON.parse(cachedProd));
      if (cachedCat) setKategoriList(JSON.parse(cachedCat));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Appends a new 1280-dimension vector embedding to the product's list of embeddings.
   */
  const saveEmbedding = async (id: number, embedding: number[]): Promise<boolean> => {
    try {
      // Get the existing product data
      const { data: product, error: fetchError } = await supabase
        .from('produk')
        .select('foto_embedding')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      // Handle appending multiple embeddings for multi-angle scanning accuracy
      let currentEmbeddings: number[][] = product?.foto_embedding
        ? (product.foto_embedding as number[][])
        : [];
      
      currentEmbeddings.push(embedding);

      // Save list back to Supabase
      const { error: updateError } = await supabase
        .from('produk')
        .update({ foto_embedding: currentEmbeddings })
        .eq('id', id);

      if (updateError) throw updateError;
      
      await fetchAll(); // Refresh local list
      return true;
    } catch (err) {
      console.error(`Error saving embedding for product ${id}:`, err);
      throw err;
    }
  };

  /**
   * Clears all embeddings registered to a product.
   */
  const deleteEmbeddings = async (id: number): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('produk')
        .update({ foto_embedding: null })
        .eq('id', id);

      if (updateError) throw updateError;
      
      await fetchAll(); // Refresh local list
      return true;
    } catch (err) {
      console.error(`Error clearing embeddings for product ${id}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    produkList,
    kategoriList,
    loading,
    error,
    refresh: fetchAll,
    saveEmbedding,
    deleteEmbeddings,
  };
}
