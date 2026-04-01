import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  className?: string;
  textClassName?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  activeOpacity?: number;
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'large',
  fullWidth = true,
  className = '',
  textClassName = '',
  style,
  textStyle,
  activeOpacity = 0.8,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getButtonStyles = () => {
    const baseStyles = 'items-center justify-center rounded-full border-2';
    const sizeStyles = {
      small: 'h-12 px-4',
      medium: 'h-14 px-6',
      large: 'h-16 px-8',
    };
    const variantStyles = {
      primary: isDisabled ? 'bg-gray-300 border-gray-300' : 'bg-primary border-primary',
      secondary: isDisabled ? 'bg-gray-300 border-gray-300' : 'bg-secondary border-secondary',
      outline: isDisabled ? 'bg-transparent border-gray-300' : 'bg-transparent border-primary',
      ghost: isDisabled ? 'bg-transparent border-transparent' : 'bg-transparent border-transparent',
    };
    const widthStyles = fullWidth ? 'w-full' : '';

    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyles} ${className}`;
  };

  const getTextStyles = () => {
    const baseStyles = 'font-oxanium-bold text-center font-semibold';
    const sizeStyles = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
    };
    const variantStyles = {
      primary: isDisabled ? 'text-gray-500' : 'text-white',
      secondary: isDisabled ? 'text-gray-500' : 'text-white',
      outline: isDisabled ? 'text-gray-500' : 'text-primary',
      ghost: isDisabled ? 'text-gray-500' : 'text-primary',
    };

    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${textClassName}`;
  };

  return (
    <TouchableOpacity
      className={getButtonStyles()}
      style={style}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity}>
      {loading ? (
        <ActivityIndicator 
          color={variant === 'primary' || variant === 'secondary' ? 'white' : 'primary'} 
          size="large" 
        />
      ) : (
        <Text className={getTextStyles()} style={textStyle}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
