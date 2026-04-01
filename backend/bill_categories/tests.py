from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import BillCategory

User = get_user_model()


class BillCategoryModelTest(TestCase):
    """
    Test cases for BillCategory model
    """
    
    def setUp(self):
        self.category = BillCategory.objects.create(
            name='Electricity',
            description='Monthly electricity consumption charges',
            icon='zap',
            color='orange'
        )
    
    def test_category_creation(self):
        """Test that a bill category can be created"""
        self.assertEqual(self.category.name, 'Electricity')
        self.assertEqual(self.category.icon, 'zap')
        self.assertEqual(self.category.color, 'orange')
        self.assertTrue(self.category.is_active)
    
    def test_category_string_representation(self):
        """Test the string representation of a category"""
        self.assertIn('Electricity', str(self.category))
    
    def test_category_default_active_status(self):
        """Test that new categories are active by default"""
        self.assertTrue(self.category.is_active)
    
    def test_category_name_trimming(self):
        """Test that category names are trimmed"""
        category = BillCategory.objects.create(
            name='  Water  ',
            description='Water charges',
            icon='droplet',
            color='blue'
        )
        self.assertEqual(category.name, 'Water')


class BillCategoryAPITest(APITestCase):
    """
    Test cases for BillCategory API endpoints
    """
    
    def setUp(self):
        # Create a test user
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Create test categories
        self.category1 = BillCategory.objects.create(
            name='Electricity',
            description='Monthly electricity charges',
            icon='zap',
            color='orange'
        )
        self.category2 = BillCategory.objects.create(
            name='Water',
            description='Water consumption charges',
            icon='droplet',
            color='blue',
            is_active=False
        )
    
    def test_list_categories(self):
        """Test retrieving list of categories"""
        response = self.client.get('/api/bill-categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
    
    def test_create_category(self):
        """Test creating a new category"""
        data = {
            'name': 'Gas',
            'description': 'Natural gas charges',
            'icon': 'flame',
            'color': 'red'
        }
        response = self.client.post('/api/bill-categories/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BillCategory.objects.count(), 3)
    
    def test_retrieve_category(self):
        """Test retrieving a single category"""
        response = self.client.get(f'/api/bill-categories/{self.category1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Electricity')
    
    def test_update_category(self):
        """Test updating a category"""
        data = {
            'name': 'Updated Electricity',
            'description': 'Updated description',
            'icon': 'zap',
            'color': 'orange'
        }
        response = self.client.put(
            f'/api/bill-categories/{self.category1.id}/',
            data
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.category1.refresh_from_db()
        self.assertEqual(self.category1.name, 'Updated Electricity')
    
    def test_delete_category(self):
        """Test deleting a category"""
        response = self.client.delete(f'/api/bill-categories/{self.category1.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(BillCategory.objects.count(), 1)
    
    def test_toggle_status(self):
        """Test toggling category status"""
        response = self.client.patch(
            f'/api/bill-categories/{self.category1.id}/toggle-status/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.category1.refresh_from_db()
        self.assertFalse(self.category1.is_active)
    
    def test_filter_active_categories(self):
        """Test filtering by active status"""
        response = self.client.get('/api/bill-categories/?is_active=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
    
    def test_unauthenticated_access(self):
        """Test that unauthenticated users cannot access the API"""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/bill-categories/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
