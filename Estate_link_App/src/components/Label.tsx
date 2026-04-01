import React from 'react';
import { Text, View, Platform, ViewStyle, TextStyle } from 'react-native';

interface LabelProps {
  text: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Label: React.FC<LabelProps> = ({ 
  text, 
  variant = 'default', 
  size = 'md',
  className = '',
  style,
  textStyle
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-100 border border-green-300';
      case 'warning':
        return 'bg-yellow-100 border border-yellow-300';
      case 'error':
        return 'bg-red-100 border border-red-300';
      case 'info':
        return 'bg-blue-100 border border-blue-300';
      default:
        return 'bg-gray-100 border border-gray-300';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'success':
        return 'text-green-700';
      case 'warning':
        return 'text-yellow-700';
      case 'error':
        return 'text-red-700';
      case 'info':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'lg':
        return 'px-4 py-2 text-lg';
      default:
        return 'px-3 py-1 text-base';
    }
  };

  // iOS-specific font rendering fixes
  const getIOSFontStyle = (): TextStyle => {
    if (Platform.OS === 'ios') {
      return {
        fontFamily: 'Oxanium-Bold',
        fontWeight: '700',
        textAlignVertical: 'center',
        includeFontPadding: false,
        // Additional iOS text rendering improvements
        lineHeight: size === 'sm' ? 16 : size === 'lg' ? 24 : 20,
        // Ensure text is properly centered on iOS
        textAlign: 'center',
        // iOS-specific text rendering fixes
        letterSpacing: 0.2,
      };
    }
    return {};
  };

  // Fallback font handling for when custom fonts fail to load
  const getFallbackFontStyle = (): TextStyle => {
    return {
      fontWeight: '700',
      // Use system fonts as fallback
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    };
  };

  // Debug logging for font issues
  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      console.log('Label component rendering on iOS with text:', text);
    }
  }, [text]);

  return (
    <View 
      className={`${getVariantStyles()} ${getSizeStyles()} rounded-full ${className}`}
      style={style}
    >
      <Text 
        className={`font-oxanium-bold ${getTextColor()}`}
        style={[getIOSFontStyle(), getFallbackFontStyle(), textStyle]}
        // Ensure text is selectable and accessible
        selectable={false}
        allowFontScaling={true}
        minimumFontScale={0.8}
        maxFontSizeMultiplier={1.2}
        // iOS-specific text properties
        adjustsFontSizeToFit={Platform.OS === 'ios'}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
};

export default Label;
