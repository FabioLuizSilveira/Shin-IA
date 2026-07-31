import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "./screens/LoginScreen";
import { RentalsListScreen } from "./screens/RentalsListScreen";
import { RentalDetailScreen } from "./screens/RentalDetailScreen";
import { useAuth } from "./lib/auth-context";

export type RootStackParamList = {
  Login: undefined;
  RentalsList: undefined;
  RentalDetail: { rentalId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {session ? (
          <>
            <Stack.Screen
              name="RentalsList"
              component={RentalsListScreen}
              options={{ title: "Minhas Locações" }}
            />
            <Stack.Screen
              name="RentalDetail"
              component={RentalDetailScreen}
              options={{ title: "Detalhe da Locação" }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
