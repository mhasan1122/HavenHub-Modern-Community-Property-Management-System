from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BillCategoryViewSet

# Create a router and register our viewset
router = DefaultRouter()
router.register(r'bill-categories', BillCategoryViewSet, basename='billcategory')

urlpatterns = router.urls
