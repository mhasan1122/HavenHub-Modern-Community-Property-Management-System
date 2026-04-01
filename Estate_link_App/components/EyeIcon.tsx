import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Primary color from Tailwind config - using the actual value to avoid TypeScript issues
const PRIMARY_COLOR = '#3C9D9B';

interface EyeIconProps {
  isVisible: boolean;
  onPress: () => void;
  size?: number;
  style?: any;
  disabled?: boolean;
}

export const EyeIcon: React.FC<EyeIconProps> = ({
  isVisible,
  onPress,
  size = 24,
  style,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      style={[
        style,
        {
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      disabled={disabled}>
      <Ionicons
        name={isVisible ? 'eye-off' : 'eye'}
        size={size}
        color={disabled ? '#9CA3AF' : PRIMARY_COLOR}
      />
    </TouchableOpacity>
  );
};
