import { create } from 'zustand';

export type CartItem = {
  id: number | string;
  name: string;
  price: number;
  quantity: number;
  category_id?: number | string | null;
};

type OrderState = {
  tableId: number | string | null;
  tableName?: string | null;
  items: CartItem[];
  heldOrderId?: number | string | null;
  setTable: (id: number | string, name?: string) => void;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  increaseQty: (id: number | string) => void;
  decreaseQty: (id: number | string) => void;
  removeItem: (id: number | string) => void;
  clear: () => void;
  subtotal: () => number;
  total: () => number;
  setHeldOrderId: (id?: number | string | null) => void;
};

export const useOrderStore = create<OrderState>((set, get) => ({
  tableId: null,
  tableName: null,
  items: [],
  heldOrderId: null,
  setTable: (id, name) => set({ tableId: id, tableName: name || null }),
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),
  increaseQty: (id) =>
    set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)) })),
  decreaseQty: (id) =>
    set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)) })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [], tableId: null, tableName: null, heldOrderId: null }),
  subtotal: () => get().items.reduce((s, it) => s + it.price * it.quantity, 0),
  total: () => get().items.reduce((s, it) => s + it.price * it.quantity, 0),
  setHeldOrderId: (id) => set({ heldOrderId: id || null }),
}));
