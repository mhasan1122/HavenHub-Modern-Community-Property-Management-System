import React, { forwardRef, useState, useEffect, useRef } from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps,
  View,
  Text,
  Animated
} from 'react-native';
import { ErrorMessage } from './ErrorMessage';

interface CustomTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  floatingLabel?: boolean; // Enable floating label animation
}

const TextInput = forwardRef<RNTextInput, CustomTextInputProps>(
  (
    {
      label,
      error,
      required = false,
      containerClassName = '',
      labelClassName = '',
      inputClassName = '',
      style,
      floatingLabel = true, // Enable by default
      value,
      placeholder,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    // Animate label position based on focus and value
    useEffect(() => {
      Animated.timing(animatedValue, {
        toValue: isFocused || value ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isFocused, value, animatedValue]);

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    // Animated styles for floating label (required for animation)
    const labelStyle = {
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [20, -10],
      }),
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 14],
      }),
      color: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#9ca3af', '#3C9D9B'],
      }),
    };

    if (!floatingLabel || !label) {
      // Standard input without floating label
      return (
        <View className={containerClassName}>
          {label && (
            <Text className={`mb-4 font-lato-semibold text-xl ${labelClassName}`}>
              {label}
              {required && <Text className="text-primary">*</Text>}
            </Text>
          )}
          <RNTextInput
            ref={ref}
            className={`font-lato rounded-md border border-gray-200 bg-white p-4 text-base text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${inputClassName}`}
            placeholderTextColor="#9ca3af"
            underlineColorAndroid="transparent"
            value={value}
            placeholder={placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
          <ErrorMessage message={error || ''} visible={!!error} />
        </View>
      );
    }

    // Floating label input
    return (
      <View className={containerClassName}>
        <View className="relative">
          <Animated.Text
            className="absolute left-4 bg-white px-1 font-lato-semibold z-10"
            style={labelStyle}
          >
            {label}
            {required && <Text className="text-primary">*</Text>}
          </Animated.Text>
          <RNTextInput
            ref={ref}
            className={`font-lato rounded-md border-2 bg-white p-4 pt-5 text-base text-gray-700 ${isFocused ? 'border-primary' : 'border-gray-200'
              } ${inputClassName}`}
            placeholder={isFocused ? placeholder : ''}
            placeholderTextColor="#9ca3af"
            underlineColorAndroid="transparent"
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
        </View>
        <ErrorMessage message={error || ''} visible={!!error} />
      </View>
    );
  }
);

TextInput.displayName = 'TextInput';

export default TextInput;

