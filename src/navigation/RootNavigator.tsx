import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import TablesScreen from '../screens/TablesScreen';
import OrderScreen from '../screens/OrderScreen';
import MenuManagementScreen from '../screens/MenuManagementScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { SAGE_GREEN, OFF_WHITE, BLACK } from '../constants';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: OFF_WHITE,
    primary: SAGE_GREEN,
    text: BLACK,
  },
};

export default function RootNavigator() {
  return (
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
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Tables" component={TablesScreen} />
        <Tab.Screen name="Order" component={OrderScreen} />
        <Tab.Screen name="Menu" component={MenuManagementScreen} options={{ title: 'Menu' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
