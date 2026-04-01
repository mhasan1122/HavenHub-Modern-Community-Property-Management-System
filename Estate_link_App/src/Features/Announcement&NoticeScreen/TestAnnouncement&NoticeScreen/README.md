# Announcement&NoticeScreen Unit Tests

This directory contains comprehensive unit tests for the Announcement&NoticeScreen components.

## Test Files

### 1. `AnnouncementNotice.test.tsx`
Tests for the main `AnnouncementNotice` component including:
- Component rendering and basic functionality
- Authentication states (loading, authenticated, unauthenticated)
- Tab navigation between announcements and bulletin board
- Filter functionality (date, priority, label filters)
- Announcement display and formatting
- Empty states and error handling
- Data fetching and API integration
- Time formatting utilities
- Bulletin board integration

### 2. `TestAnnouncement.test.tsx`
Tests for the `TestAnnouncement` component including:
- Component rendering and configuration display
- URL testing functionality
- Health check operations (basic and enhanced)
- Test results display and formatting
- Error handling for network failures
- Navigation functionality
- Component lifecycle management

### 3. `index.test.ts`
Tests for the module exports including:
- Export structure validation
- Import/export consistency
- TypeScript compatibility
- Module loading and error handling
- Future extensibility considerations

## Running Tests

### Option 1: Using the test runner script
```bash
cd Estate_link_App/src/Features/Announcement&NoticeScreen/TestAnnouncement&NoticeScreen
node run-tests.js
```

### Option 2: Using Jest directly
```bash
# Run all tests in this directory
npx jest --testPathPattern="TestAnnouncement&NoticeScreen"

# Run specific test file
npx jest AnnouncementNotice.test.tsx

# Run with coverage
npx jest --testPathPattern="TestAnnouncement&NoticeScreen" --coverage

# Run in watch mode
npx jest --testPathPattern="TestAnnouncement&NoticeScreen" --watch
```

### Option 3: Using npm scripts (if configured in package.json)
```bash
npm test -- --testPathPattern="TestAnnouncement&NoticeScreen"
```

## Test Coverage

The tests cover:
- ✅ Component rendering and UI elements
- ✅ User interactions and event handling
- ✅ State management and data flow
- ✅ API integration and data fetching
- ✅ Error handling and edge cases
- ✅ Navigation and routing
- ✅ Authentication states
- ✅ Filtering and search functionality
- ✅ Time formatting and utilities
- ✅ Component lifecycle methods

## Mocking Strategy

The tests use comprehensive mocking for:
- **React Navigation**: Navigation hooks and components
- **Redux Store**: State management and selectors
- **Custom Hooks**: `useAnnouncements` and `useNotices`
- **External Components**: AttachmentViewer, NoticeBoardCard, etc.
- **Utilities**: Photo utilities, health check functions
- **Icons**: Expo vector icons
- **Date/Time**: DateTimePicker component

## Test Data

Mock data is provided for:
- User authentication state
- Announcements with various properties
- Notices with different statuses
- Configuration objects
- API responses and errors

## Best Practices

1. **Isolation**: Each test is isolated and doesn't depend on other tests
2. **Mocking**: External dependencies are properly mocked
3. **Assertions**: Clear and specific assertions for expected behavior
4. **Coverage**: Comprehensive coverage of component functionality
5. **Maintainability**: Tests are well-organized and documented

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Ensure all mock objects match expected interfaces
2. **Import Errors**: Check that all dependencies are properly mocked
3. **Async Operations**: Use `waitFor` for asynchronous operations
4. **Navigation**: Mock navigation hooks properly for routing tests

### Debug Mode

To run tests in debug mode:
```bash
npx jest --testPathPattern="TestAnnouncement&NoticeScreen" --verbose --no-cache
```

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Add proper mocking for new dependencies
3. Include both positive and negative test cases
4. Update this README if adding new test categories
5. Ensure tests are isolated and don't affect each other
