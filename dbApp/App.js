import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from 'expo-linking';
import Homescreen from "./src/screens/Homescreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import LoginScreen from "./src/screens/LoginScreen";
import BookingTypeScreen from "./src/screens/BookingTypeScreen";
import VisitorRegisterScreen from "./src/screens/VisitorRegisterScreen";
import BookParkingScreen from "./src/screens/BookParkingScreen";
import ReservationScreen from "./src/screens/ReservationScreen";
import PaymentScreen from "./src/screens/PaymentScreen";
import MyParkingScreen from "./src/screens/MyParkingScreen";
import MyParkingInfoScreen from "./src/screens/MyParkingInfoScreen";
import InviteLinkScreen from "./src/screens/InviteLinkScreen";
import VisitorControlScreen from "./src/screens/VisitorControlScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import {Text} from "react-native";
import PayFineScreen from "./src/screens/PayFineScreen";
import MyCouponScreen from "./src/screens/MyCouponScreen";


const Stack = createStackNavigator();

// แก้ไข Deep Link Configuration
const linking = {
  prefixes: [
    // สำหรับ development (Expo)
    Linking.createURL('/'),
    // สำหรับ production (ถ้ามี custom domain)
    'yourapp://',
    'https://yourapp.com/',
    // สำหรับ Expo Go (development)
    'exp://192.168.1.100:8081/',
    // Universal Link (ถ้าต้องการใช้ใน production)
    'https://yourapp.netlify.app/',
  ],
  config: {
    screens: {
      Home: '',
      Register: 'register',
      Login: 'login',
      BookingType: 'booking-type',
      VisitorRegister: 'visitor-register',
      BookParking: 'book-parking',
      Reservation: 'reservation',
      Payment: 'payment',
      MyParking: 'my-parking',
      MyParkingInfo: 'my-parking-info',
      InviteLink: 'invite-link',
      // กำหนด path สำหรับ VisitorControl ให้รับ parameter
      VisitorControl: {
        path: 'visitor/:sessionId',
        parse: {
          sessionId: (sessionId) => sessionId,
        },
      },
    },
  },
};

const App = () => {
  return (
    <NavigationContainer 
      linking={linking}
      fallback={<Text>Loading...</Text>}
      onStateChange={(state) => {
        // Debug: ดู navigation state (optional)
        console.log('Navigation state changed:', state);
      }}
    >
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={Homescreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookingType"
          component={BookingTypeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VisitorRegister"
          component={VisitorRegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookParking"
          component={BookParkingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Reservation"
          component={ReservationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyParking"
          component={MyParkingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyParkingInfo"
          component={MyParkingInfoScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="InviteLink"
          component={InviteLinkScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VisitorControl"
          component={VisitorControlScreen}
          options={{ 
            headerShown: false,
            // ป้องกันการย้อนกลับ (optional)
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PayFine"
          component={PayFineScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyCoupon"
          component={MyCouponScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;