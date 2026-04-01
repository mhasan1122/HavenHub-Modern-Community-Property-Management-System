import { View, Text } from 'react-native';

interface ErrorMessageProps {
  message: string;
  visible: boolean;
}

export function ErrorMessage({ message, visible }: ErrorMessageProps) {
  if (!visible) return null;

  return (
    <View className="mb-4 flex-row items-center">
      <View className="mr-3">
        <Text className="font-bold text-error" style={{ fontSize: 18 }}>
          ⚠
        </Text>
      </View>
      <Text className="flex-1 text-error" style={{ fontSize: 16, fontFamily: 'Oxanium-Medium' }}>
        {message}
      </Text>
    </View>
  );
}
