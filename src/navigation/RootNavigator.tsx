import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import TablesScreen from '../screens/TablesScreen';
import OrderScreen from '../screens/OrderScreen';
import MenuManagementScreen from '../screens/MenuManagementScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BillingScreen from '../screens/BillingScreen';
import ReceiptScreen from '../screens/ReceiptScreen';
import KotScreen from '../screens/KotScreen';
import { SAGE_GREEN, OFF_WHITE, BLACK } from '../constants';
import { AuthRoleProvider, type UserRole } from '../auth/AuthContext';

const Tab = createBottomTabNavigator();

type RootNavigatorProps = {
  role: UserRole;
  initialTableId?: number | null;
  isGuest?: boolean;
  onLogout: () => void;
};

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: OFF_WHITE,
    primary: SAGE_GREEN,
    text: BLACK,
  },
};

const roleTabs: Record<UserRole, string[]> = {
  owner: ['Dashboard', 'Tables', 'Order', 'Menu', 'Billing', 'Receipt', 'KOT', 'Settings'],
  manager: ['Dashboard', 'Tables', 'Order', 'Menu', 'Billing', 'Receipt', 'KOT', 'Settings'],
  cashier: ['Tables', 'Order', 'Billing', 'Receipt', 'Settings'],
  server: ['Tables', 'Order', 'KOT', 'Settings'],
  customer: ['Tables', 'Order'],
  kitchen: ['KOT', 'Settings'],
};

export default function RootNavigator({ role, initialTableId, isGuest = false, onLogout }: RootNavigatorProps) {
  const canShow = (tabName: string) => roleTabs[role].includes(tabName);

  return (
    <AuthRoleProvider role={role} isGuest={isGuest} logout={onLogout}>
      <NavigationContainer theme={theme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: OFF_WHITE },
            headerTitleStyle: { color: BLACK },
            tabBarActiveTintColor: SAGE_GREEN,
            tabBarInactiveTintColor: '#666',
            tabBarStyle: { backgroundColor: OFF_WHITE },
          }}
        >
          {canShow('Dashboard') ? <Tab.Screen name="Dashboard" component={DashboardScreen} /> : null}
          {canShow('Tables') ? <Tab.Screen name="Tables" component={TablesScreen} initialParams={{ qrTableId: initialTableId }} /> : null}
          {canShow('Order') ? <Tab.Screen name="Order" component={OrderScreen} initialParams={{ tableId: initialTableId }} /> : null}
          {canShow('Menu') ? <Tab.Screen name="Menu" component={MenuManagementScreen} options={{ title: 'Menu' }} /> : null}
          {canShow('Billing') ? <Tab.Screen name="Billing" component={BillingScreen} options={{ title: 'Billing' }} /> : null}
          {canShow('Receipt') ? <Tab.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Receipt' }} /> : null}
          {canShow('KOT') ? <Tab.Screen name="KOT" component={KotScreen} options={{ title: 'KOT' }} /> : null}
          {canShow('Settings') ? <Tab.Screen name="Settings" component={SettingsScreen} /> : null}
        </Tab.Navigator>
      </NavigationContainer>
    </AuthRoleProvider>
  );
}
