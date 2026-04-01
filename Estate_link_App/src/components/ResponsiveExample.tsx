import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  spacing,
  fontSizes,
  iconSizes,
  borderRadius,
  getGridColumns,
  getGridItemWidth,
  getScreenSize,
  useResponsiveDimensions,
  getResponsiveImageSize,
  widthPercentage,
  heightPercentage,
} from '../utils/responsiveUtils';
import { isTablet } from '../utils/deviceInfo';
import { responsiveStyles } from '../utils/responsiveStyles';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ResponsiveExample = () => {
  const { screenSize, isTablet: isTabletDevice } = useResponsiveDimensions();
  const gridColumns = getGridColumns();
  const gridItemWidth = getGridItemWidth(gridColumns);

  // Example data
  const features = [
    { id: 1, title: 'Announcements', icon: '📢' },
    { id: 2, title: 'Complaints', icon: '📝' },
    { id: 3, title: 'Bulletin Board', icon: '📋' },
    { id: 4, title: 'Notice Board', icon: '📌' },
    { id: 5, title: 'Suggestions', icon: '💡' },
    { id: 6, title: 'Amenities', icon: '🏊' },
  ];

  return (
    <SafeAreaView style={responsiveStyles.flex1}>
      <ScrollView 
        style={responsiveStyles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={[
          responsiveStyles.header,
          { backgroundColor: '#3C9D9B', marginBottom: spacing.lg }
        ]}>
          <Text style={[
            responsiveStyles.textXLarge,
            responsiveStyles.textBold,
            { color: 'white' }
          ]}>
            Responsive Design Demo
          </Text>
          <Text style={[
            responsiveStyles.textSmall,
            { color: 'white', opacity: 0.8 }
          ]}>
            Screen: {screenSize} | Device: {isTabletDevice ? 'Tablet' : 'Phone'}
          </Text>
        </View>

        {/* Responsive Grid Example */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Responsive Grid ({gridColumns} columns)
          </Text>
          
          <View style={responsiveStyles.gridContainer}>
            {features.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={[
                  responsiveStyles.gridItem,
                  {
                    width: gridItemWidth,
                    alignItems: 'center',
                    padding: spacing.sm,
                    backgroundColor: '#f8fafc',
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.md,
                  }
                ]}
              >
                <Text style={[
                  responsiveStyles.textLarge,
                  { marginBottom: spacing.xs }
                ]}>
                  {feature.icon}
                </Text>
                <Text style={[
                  responsiveStyles.textSmall,
                  responsiveStyles.textBold,
                  { textAlign: 'center', color: '#374151' }
                ]}>
                  {feature.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Responsive Typography Example */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Responsive Typography
          </Text>
          
          <Text style={[
            responsiveStyles.textXLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.sm, color: '#1f2937' }
          ]}>
            Extra Large Text ({fontSizes.xl}px)
          </Text>
          
          <Text style={[
            responsiveStyles.textLarge,
            { marginBottom: spacing.sm, color: '#374151' }
          ]}>
            Large Text ({fontSizes.lg}px)
          </Text>
          
          <Text style={[
            responsiveStyles.text,
            { marginBottom: spacing.sm, color: '#6b7280' }
          ]}>
            Base Text ({fontSizes.base}px)
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { color: '#9ca3af' }
          ]}>
            Small Text ({fontSizes.sm}px)
          </Text>
        </View>

        {/* Responsive Spacing Example */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Responsive Spacing
          </Text>
          
          <View style={[
            responsiveStyles.flexRow,
            responsiveStyles.itemsCenter,
            { marginBottom: spacing.sm }
          ]}>
            <View style={[
              { 
                width: spacing.xs, 
                height: spacing.xs, 
                backgroundColor: '#ef4444',
                borderRadius: spacing.xs / 2
              }
            ]} />
            <Text style={[
              responsiveStyles.textSmall,
              { marginLeft: spacing.sm, color: '#6b7280' }
            ]}>
              Extra Small: {spacing.xs}px
            </Text>
          </View>
          
          <View style={[
            responsiveStyles.flexRow,
            responsiveStyles.itemsCenter,
            { marginBottom: spacing.sm }
          ]}>
            <View style={[
              { 
                width: spacing.sm, 
                height: spacing.sm, 
                backgroundColor: '#f59e0b',
                borderRadius: spacing.sm / 2
              }
            ]} />
            <Text style={[
              responsiveStyles.textSmall,
              { marginLeft: spacing.sm, color: '#6b7280' }
            ]}>
              Small: {spacing.sm}px
            </Text>
          </View>
          
          <View style={[
            responsiveStyles.flexRow,
            responsiveStyles.itemsCenter,
            { marginBottom: spacing.sm }
          ]}>
            <View style={[
              { 
                width: spacing.md, 
                height: spacing.md, 
                backgroundColor: '#10b981',
                borderRadius: spacing.md / 2
              }
            ]} />
            <Text style={[
              responsiveStyles.textSmall,
              { marginLeft: spacing.sm, color: '#6b7280' }
            ]}>
              Medium: {spacing.md}px
            </Text>
          </View>
          
          <View style={[
            responsiveStyles.flexRow,
            responsiveStyles.itemsCenter,
            { marginBottom: spacing.sm }
          ]}>
            <View style={[
              { 
                width: spacing.lg, 
                height: spacing.lg, 
                backgroundColor: '#3b82f6',
                borderRadius: spacing.lg / 2
              }
            ]} />
            <Text style={[
              responsiveStyles.textSmall,
              { marginLeft: spacing.sm, color: '#6b7280' }
            ]}>
              Large: {spacing.lg}px
            </Text>
          </View>
        </View>

        {/* Responsive Images Example */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Responsive Images
          </Text>
          
          <View style={[
            responsiveStyles.flexRow,
            { justifyContent: 'space-between', marginBottom: spacing.md }
          ]}>
            <View style={{
              width: isTablet() ? 120 : 80,
              height: isTablet() ? 120 : 80,
              backgroundColor: '#e5e7eb',
              borderRadius: borderRadius.md,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={[
                responsiveStyles.textSmall,
                { textAlign: 'center', color: '#6b7280' }
              ]}>
                {isTablet() ? '120x120' : '80x80'}
              </Text>
            </View>
            
            <View style={{
              width: isTablet() ? 160 : 120,
              height: isTablet() ? 120 : 90,
              backgroundColor: '#d1d5db',
              borderRadius: borderRadius.md,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={[
                responsiveStyles.textSmall,
                { textAlign: 'center', color: '#6b7280' }
              ]}>
                {isTablet() ? '160x120' : '120x90'}
              </Text>
            </View>
          </View>
          
          <Text style={[
            responsiveStyles.textSmall,
            { color: '#6b7280', textAlign: 'center' }
          ]}>
            Images scale based on device type
          </Text>
        </View>

        {/* Responsive Buttons Example */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Responsive Buttons
          </Text>
          
          <TouchableOpacity style={[
            responsiveStyles.button,
            responsiveStyles.buttonPrimary,
            { marginBottom: spacing.md }
          ]}>
            <Text style={[
              responsiveStyles.textBold,
              { color: 'white' }
            ]}>
              Primary Button ({isTablet() ? '56px' : '48px'} height)
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[
            responsiveStyles.button,
            responsiveStyles.buttonSecondary,
            { marginBottom: spacing.md }
          ]}>
            <Text style={[
              responsiveStyles.textBold,
              { color: '#374151' }
            ]}>
              Secondary Button
            </Text>
          </TouchableOpacity>
        </View>

        {/* Screen Dimensions Info */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Screen Information
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { marginBottom: spacing.xs, color: '#6b7280' }
          ]}>
            Screen Width: {screenWidth}px
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { marginBottom: spacing.xs, color: '#6b7280' }
          ]}>
            Screen Height: {screenHeight}px
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { marginBottom: spacing.xs, color: '#6b7280' }
          ]}>
            Screen Size: {screenSize}
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { marginBottom: spacing.xs, color: '#6b7280' }
          ]}>
            Device Type: {isTabletDevice ? 'Tablet' : 'Phone'}
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { marginBottom: spacing.xs, color: '#6b7280' }
          ]}>
            Grid Columns: {gridColumns}
          </Text>
          
          <Text style={[
            responsiveStyles.textSmall,
            { color: '#6b7280' }
          ]}>
            Grid Item Width: {Math.round(gridItemWidth)}px
          </Text>
        </View>

        {/* Percentage-based Layout Example */}
        <View style={[responsiveStyles.card, { marginBottom: spacing.lg }]}>
          <Text style={[
            responsiveStyles.textLarge,
            responsiveStyles.textBold,
            { marginBottom: spacing.md, color: '#1f2937' }
          ]}>
            Percentage-based Layout
          </Text>
          
          <View style={{
            width: widthPercentage(80),
            height: heightPercentage(15),
            backgroundColor: '#3C9D9B',
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center'
          }}>
            <Text style={[
              responsiveStyles.textBold,
              { color: 'white', textAlign: 'center' }
            ]}>
              80% Width × 15% Height
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ResponsiveExample;
