import React from 'react';
import { View, Animated, DimensionValue } from 'react-native';
import { useEffect, useRef } from 'react';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E1E9EE',
          opacity,
        },
        style,
      ]}
    />
  );
};

interface SkeletonCardProps {
  width?: DimensionValue;
  height?: DimensionValue;
  showImage?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  width = 300,
  height = 200,
  showImage = true,
  showTitle = true,
  showDescription = true,
  showFooter = true,
}) => {
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {showImage && (
        <SkeletonLoader
          width="100%"
          height={80}
          borderRadius={6}
          style={{ marginBottom: 12 }}
        />
      )}
      
      {showTitle && (
        <SkeletonLoader
          width="80%"
          height={16}
          borderRadius={4}
          style={{ marginBottom: 8 }}
        />
      )}
      
      {showDescription && (
        <>
          <SkeletonLoader
            width="100%"
            height={12}
            borderRadius={4}
            style={{ marginBottom: 6 }}
          />
          <SkeletonLoader
            width="60%"
            height={12}
            borderRadius={4}
            style={{ marginBottom: 12 }}
          />
        </>
      )}
      
      {showFooter && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <SkeletonLoader width={60} height={12} borderRadius={4} />
          <SkeletonLoader width={40} height={12} borderRadius={4} />
        </View>
      )}
    </View>
  );
};

interface SkeletonGridProps {
  columns?: number;
  itemWidth?: number;
  itemHeight?: number;
  count?: number;
  spacing?: number;
}

export const SkeletonGrid: React.FC<SkeletonGridProps> = ({
  columns = 2,
  itemWidth = 150,
  itemHeight = 200,
  count = 6,
  spacing = 16,
}) => {
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: spacing / 2,
      }}
    >
      {items.map((item) => (
        <View
          key={item}
          style={{
            width: itemWidth,
            height: itemHeight,
            marginBottom: spacing,
          }}
        >
          <SkeletonCard
            width="100%"
            height="100%"
            showImage={true}
            showTitle={true}
            showDescription={false}
            showFooter={true}
          />
        </View>
      ))}
    </View>
  );
};

export default SkeletonLoader;
