# Screen Shaking Fix Documentation

## Problem Description
The app was experiencing screen shaking/trembling when navigating between tabs, especially after the navbar loaded. This was caused by:

1. **Layout shifts** during data loading
2. **Content height changes** after data arrives
3. **Loading states** causing re-renders that affect layout
4. **Authentication checks** causing conditional rendering
5. **Multiple useEffect hooks** causing cascading re-renders

## Root Causes

### 1. useEffect vs useFocusEffect
- **Before**: Using `useEffect` for data fetching caused data to be fetched every time the component re-rendered
- **After**: Using `useFocusEffect` ensures data is only fetched when the screen comes into focus

### 2. Loading State Management
- **Before**: Loading indicators were shown for every data fetch, causing layout shifts
- **After**: Only show loading indicators for initial loads, use subtle indicators for subsequent updates

### 3. Missing Skeleton Loading
- **Before**: Empty content areas caused layout shifts when data loaded
- **After**: Skeleton loaders provide stable placeholder content with consistent dimensions

### 4. Authentication State Handling
- **Before**: Multiple authentication checks caused conditional rendering
- **After**: Centralized authentication handling with proper state management

## Changes Made

### 1. Dashboard.tsx
- Replaced `useEffect` with `useFocusEffect` for data fetching
- Added `isInitialized` state to prevent duplicate data fetching
- Improved loading state management
- Added skeleton loading for pinned announcements

### 2. NoticeBoard.tsx
- Replaced `useEffect` with `useFocusEffect` for data fetching
- Added `isInitialized` state
- Added skeleton grid loading for initial load
- Improved loading state management

### 3. AnnouncementNotice.tsx
- Replaced `useEffect` with `useFocusEffect` for data fetching
- Added `isInitialized` state
- Added skeleton loading for both announcements and notices
- Improved loading state management

### 4. New Components
- **SkeletonLoader.tsx**: Basic skeleton loading component
- **SkeletonCard.tsx**: Card-shaped skeleton loader
- **SkeletonGrid.tsx**: Grid layout skeleton loader

## Key Benefits

### 1. Smoother Navigation
- No more screen shaking when switching tabs
- Consistent layout dimensions during loading
- Better user experience

### 2. Improved Performance
- Data is only fetched when needed
- Reduced unnecessary re-renders
- Better memory management

### 3. Better UX
- Skeleton loaders provide visual feedback
- Loading states are more intuitive
- Consistent visual hierarchy

## Implementation Details

### useFocusEffect Usage
```typescript
useFocusEffect(
  useCallback(() => {
    if (user?.id && !isInitialized) {
      if (!hasLoadedOnce) {
        getNotices();
      }
      if (!announcementsLoadedOnce) {
        getAnnouncements();
      }
      setIsInitialized(true);
    }
  }, [user?.id, hasLoadedOnce, announcementsLoadedOnce, getNotices, getAnnouncements, isInitialized])
);
```

### Skeleton Loading
```typescript
{noticesLoading && !noticesHasLoadedOnce ? (
  <View className="py-8">
    <SkeletonGrid
      columns={2}
      itemWidth={cardWidth}
      itemHeight={160}
      count={6}
      spacing={16}
    />
  </View>
) : (
  // Actual content
)}
```

### Loading State Management
```typescript
// Only show subtle indicator for subsequent loads
{noticesLoading && noticesHasLoadedOnce && notices.length > 0 && (
  <View className="mx-4 mb-4 flex-row items-center justify-center py-2">
    <ActivityIndicator size="small" color="#3C9D9B" />
    <Text className="ml-2 font-oxanium text-sm text-text-secondary">
      {refreshing ? 'Refreshing...' : 'Updating...'}
    </Text>
  </View>
)}
```

## Testing

### Test Cases
1. **Tab Navigation**: Switch between tabs multiple times
2. **Data Loading**: Observe loading states and transitions
3. **Authentication**: Test with different authentication states
4. **Refresh**: Test pull-to-refresh functionality
5. **Error States**: Test error handling and recovery

### Expected Results
- No screen shaking during navigation
- Smooth transitions between loading states
- Consistent layout dimensions
- Better overall user experience

## Future Improvements

### 1. Animation Optimization
- Add smooth fade transitions for skeleton loaders
- Implement staggered loading animations
- Add loading progress indicators

### 2. Performance Monitoring
- Track loading times and user experience metrics
- Monitor memory usage and performance
- Implement error tracking and analytics

### 3. Accessibility
- Add loading state announcements for screen readers
- Implement proper focus management
- Add loading state indicators for assistive technologies

## Conclusion

The screen shaking issue has been resolved by implementing:
1. **useFocusEffect** for better data fetching control
2. **Skeleton loading** for stable layout dimensions
3. **Improved loading state management** for better UX
4. **Centralized authentication handling** for consistent behavior

These changes provide a much smoother and more professional user experience while maintaining good performance and accessibility standards.
