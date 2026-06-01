const { create } = require('zustand');

const useOrderStore = create((set, get) => ({
  tableId: null,
  tableName: null,
  items: [],
  heldOrderId: null,
  setTable: (id, name) => set({ tableId: id, tableName: name || null }),
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return { items: state.items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)) };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),
  increaseQty: (id) => set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)) })),
  decreaseQty: (id) => set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)) })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [], tableId: null, tableName: null, heldOrderId: null }),
  subtotal: () => get().items.reduce((s, it) => s + it.price * it.quantity, 0),
  total: () => get().items.reduce((s, it) => s + it.price * it.quantity, 0),
  setHeldOrderId: (id) => set({ heldOrderId: id || null }),
}));

function snapshot() {
  const s = useOrderStore.getState();
  console.log('table:', s.tableId, s.tableName);
  console.log('items:', JSON.stringify(s.items, null, 2));
  console.log('subtotal:', s.subtotal());
}

console.log('--- Start testOrderStore ---');
useOrderStore.getState().setTable(5, 'Patio');
console.log('After setTable:');
snapshot();

console.log('\nAdd item 1 (Coffee $3):');
useOrderStore.getState().addItem({ id: 1, name: 'Coffee', price: 3 });
snapshot();

console.log('\nAdd item 1 again:');
useOrderStore.getState().addItem({ id: 1, name: 'Coffee', price: 3 });
snapshot();

console.log('\nAdd item 2 (Bagel $2.5):');
useOrderStore.getState().addItem({ id: 2, name: 'Bagel', price: 2.5 });
snapshot();

console.log('\nIncrease qty of item 2:');
useOrderStore.getState().increaseQty(2);
snapshot();

console.log('\nDecrease qty of item 1:');
useOrderStore.getState().decreaseQty(1);
snapshot();

console.log('\nRemove item 1:');
useOrderStore.getState().removeItem(1);
snapshot();

console.log('\nClear cart:');
useOrderStore.getState().clear();
snapshot();

console.log('--- End testOrderStore ---');

process.exit(0);
