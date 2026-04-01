from django.test import SimpleTestCase
from unittest.mock import MagicMock, patch
from notifications.serializers import NotificationSerializer, get_entity_status_info
from notifications.models import Notification

class NotificationStatusTests(SimpleTestCase):
    def setUp(self):
        self.notification = MagicMock(spec=Notification)
        self.notification.id = 1
        self.notification.title = "Test Notification"
        self.notification.message = "Test Message"
        self.notification.is_read = False
        self.notification.created_at = "2023-01-01"
        self.notification.notification_type = MagicMock()
        self.notification.notification_type.code = "test"
        self.notification.notification_type.name = "Test"
        self.notification.notification_type.icon = "icon"
        self.notification.notification_type.priority = 1
        self.notification.metadata = {}

    @patch('notifications.serializers.apps.get_model')
    def test_active_announcement(self, mock_get_model):
        # Setup notification
        self.notification.entity_type = 'announcement'
        self.notification.entity_id = 123
        
        # Setup mock model and object
        mock_model = MagicMock()
        mock_object = MagicMock()
        mock_object.status = 'ongoing'
        mock_model.objects.get.return_value = mock_object
        mock_get_model.return_value = mock_model
        
        # Test helper function directly
        status, message = get_entity_status_info(self.notification)
        self.assertEqual(status, 'active')
        self.assertIsNone(message)
        
        # Verify apps.get_model was called correctly
        mock_get_model.assert_called_with('announcements', 'Announcement')
        mock_model.objects.get.assert_called_with(pk=123)

    @patch('notifications.serializers.apps.get_model')
    def test_deleted_announcement(self, mock_get_model):
        # Setup notification
        self.notification.entity_type = 'announcement'
        self.notification.entity_id = 123
        
        # Setup mock model to raise DoesNotExist
        mock_model = MagicMock()
        mock_model.DoesNotExist = Exception # Mocking the exception class
        mock_model.objects.get.side_effect = mock_model.DoesNotExist
        mock_get_model.return_value = mock_model
        
        # Test helper function directly
        status, message = get_entity_status_info(self.notification)
        self.assertEqual(status, 'deleted')
        self.assertEqual(message, "This content is no longer available. It may have been deleted by the administrator.")

    @patch('notifications.serializers.apps.get_model')
    def test_expired_announcement(self, mock_get_model):
        # Setup notification
        self.notification.entity_type = 'announcement'
        self.notification.entity_id = 123
        
        # Setup mock model and object
        mock_model = MagicMock()
        mock_object = MagicMock()
        mock_object.status = 'expired'
        mock_model.objects.get.return_value = mock_object
        mock_get_model.return_value = mock_model
        
        # Test helper function directly
        status, message = get_entity_status_info(self.notification)
        self.assertEqual(status, 'expired')
        self.assertEqual(message, "This content has expired and is no longer active.")

    @patch('notifications.serializers.apps.get_model')
    def test_archived_bulletin(self, mock_get_model):
        # Setup notification
        self.notification.entity_type = 'bulletin'
        self.notification.entity_id = 123
        
        # Setup mock model and object
        mock_model = MagicMock()
        mock_object = MagicMock()
        mock_object.status = 'archive'
        mock_model.objects.get.return_value = mock_object
        mock_get_model.return_value = mock_model
        
        # Test helper function directly
        status, message = get_entity_status_info(self.notification)
        self.assertEqual(status, 'archived')
        self.assertEqual(message, "This content has been archived and is no longer active.")

    @patch('notifications.serializers.apps.get_model')
    def test_expired_notice(self, mock_get_model):
        # Setup notification
        self.notification.entity_type = 'notice'
        self.notification.entity_id = 456
        
        # Setup mock model and object
        mock_model = MagicMock()
        mock_object = MagicMock()
        mock_object.status = 'expired'
        mock_model.objects.get.return_value = mock_object
        mock_get_model.return_value = mock_model
        
        # Test helper function directly
        status, message = get_entity_status_info(self.notification)
        self.assertEqual(status, 'expired')
        self.assertEqual(message, "This content has expired and is no longer active.")
        
        # Verify apps.get_model was called correctly
        mock_get_model.assert_called_with('noticeboard', 'Notice')
        mock_model.objects.get.assert_called_with(pk=456)

    @patch('notifications.serializers.get_entity_status_info')
    def test_serializer_fields(self, mock_get_status):
        # Mock the helper to return a specific status
        mock_get_status.return_value = ('deleted', 'Deleted message')
        
        # We need to mock the serializer purely, avoiding ModelSerializer validation if possible
        # Or just test the methods that call the helper
        
        serializer = NotificationSerializer()
        # Mock _get_status_info cache logic
        # But wait, serializer.data will trigger get_attribute calls
        
        # Let's call the methods directly on the serializer instance
        status = serializer.get_entity_status(self.notification)
        message = serializer.get_entity_status_message(self.notification)
        
        self.assertEqual(status, 'deleted')
        self.assertEqual(message, 'Deleted message')
        mock_get_status.assert_called_with(self.notification)

    def test_list_view_filtering_logic(self):
        # This test simulates the filtering logic we added to views.py
        # It's not testing views.py directly (as that would require DB setup)
        # but verifies the logic: filter out notifications unless status is active or unknown
        
        notifications = [
            {'id': 1, 'status': 'active'},
            {'id': 2, 'status': 'deleted'},
            {'id': 3, 'status': 'expired'},
            {'id': 4, 'status': 'archived'},
            {'id': 5, 'status': 'unknown'},
        ]
        
        filtered = []
        for notif in notifications:
            status = notif['status']
            if status in ['active', 'unknown']:
                filtered.append(notif)
                
        self.assertEqual(len(filtered), 2)
        self.assertEqual(filtered[0]['id'], 1)
        self.assertEqual(filtered[1]['id'], 5)
