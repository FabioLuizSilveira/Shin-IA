import { View, ActivityIndicator } from 'react-native';
import { theme } from '@/src/theme';

export default function AuthCallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface }}>
      <ActivityIndicator color={theme.colors.brandSecondary} />
    </View>
  );
}
