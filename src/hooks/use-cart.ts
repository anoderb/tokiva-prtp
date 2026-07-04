import { useState, useEffect, useMemo } from 'react';
import { Produk, CartItem } from '../types';

/**
 * Custom hook to manage shopping cart state, totals, and persistence.
 */
export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load from cache on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem('tokiva_cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error parsing saved cart:', error);
      }
    }
  }, []);

  const saveCart = (items: CartItem[]) => {
    setCartItems(items);
    localStorage.setItem('tokiva_cart', JSON.stringify(items));
  };

  const addToCart = (produk: Produk, qty = 1) => {
    const existingIndex = cartItems.findIndex((item) => item.produk.id === produk.id);
    const newCart = [...cartItems];

    if (existingIndex > -1) {
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        quantity: newCart[existingIndex].quantity + qty,
      };
    } else {
      newCart.push({ produk, quantity: qty });
    }

    saveCart(newCart);
  };

  const updateQuantity = (produkId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(produkId);
      return;
    }
    const newCart = cartItems.map((item) =>
      item.produk.id === produkId ? { ...item, quantity: qty } : item
    );
    saveCart(newCart);
  };

  const removeFromCart = (produkId: number) => {
    const newCart = cartItems.filter((item) => item.produk.id !== produkId);
    saveCart(newCart);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.produk.harga_jual * item.quantity, 0);
  }, [cartItems]);

  const diskon = 0; // Editable diskon field could be added here in the future

  const total = useMemo(() => {
    return subtotal - diskon;
  }, [subtotal, diskon]);

  const totalQty = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  return {
    cartItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    diskon,
    total,
    totalQty,
  };
}
