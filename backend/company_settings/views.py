from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import CompanySettings, CompanyImage
from .serializers import CompanySettingsSerializer, CompanyImageSerializer
from user.permissions import HasRequiredPermission
from group_role.permission_constants import PERMISSION_VIEW_COMPANY_SETTINGS
from user.models import Member
from audit_trail.create_audit_trail import create_audit_trail


class CompanySettingsView(APIView):
    """
    API endpoint to get and update company settings.
    Only authenticated users with VIEW_COMPANY_SETTINGS permission can access this endpoint.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_VIEW_COMPANY_SETTINGS]
        return super().get_permissions()

    def get(self, request):
        """Get current company settings"""
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        """Update company settings"""
        settings = CompanySettings.get_settings()
        
        # Store old data for audit trail
        old_data = CompanySettingsSerializer(settings, context={'request': request}).data
        
        serializer = CompanySettingsSerializer(
            settings,
            data=request.data,
            context={'request': request},
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            
            # Get new data for audit trail
            new_data = serializer.data
            
            # Get member from request user for audit trail
            try:
                member = Member.objects.get(user=request.user)
            except Member.DoesNotExist:
                member = None
            
            # Create audit trail
            try:
                create_audit_trail(
                    member=member,
                    event_type='COMPANY_SETTINGS_UPDATED',
                    table_name='CompanySettings',
                    row_id=settings.id,
                    old_data=old_data,
                    new_data=new_data,
                    description=f'Company settings updated successfully.'
                )
            except Exception as e:
                # Log error but don't fail the update
                print(f"Error creating audit trail: {str(e)}")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        """Partially update company settings"""
        return self.put(request)


class CompanySettingsPublicView(APIView):
    """
    Public API endpoint to get company settings for login page and other public areas.
    No authentication required.
    """
    permission_classes = []

    def get(self, request):
        """Get current company settings (public)"""
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class CompanyImageListView(APIView):
    """
    API endpoint to list and create company images.
    Requires VIEW_COMPANY_SETTINGS permission.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_VIEW_COMPANY_SETTINGS]
        return super().get_permissions()

    def get(self, request):
        """Get list of company images with optional filtering by type"""
        image_type = request.query_params.get('image_type', None)
        queryset = CompanyImage.objects.all()
        
        if image_type:
            queryset = queryset.filter(image_type=image_type)
        
        serializer = CompanyImageSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Upload a new company image (auto-replace existing)"""
        serializer = CompanyImageSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            image_type = serializer.validated_data.get('image_type')
            
            # Delete all existing images of the same type (single image policy)
            CompanyImage.objects.filter(image_type=image_type).delete()
            
            # Save the new image
            company_image = serializer.save()
            
            # Automatically set as active since it's the only one
            settings = CompanySettings.get_settings()
            if image_type == 'logo':
                settings.active_logo = company_image
                settings.save()
            elif image_type == 'login_image':
                settings.active_login_image = company_image
                settings.save()
            
            # Get member from request user for audit trail
            try:
                member = Member.objects.get(user=request.user)
            except Member.DoesNotExist:
                member = None
            
            # Create audit trail
            try:
                new_data = CompanyImageSerializer(company_image, context={'request': request}).data
                create_audit_trail(
                    member=member,
                    event_type='COMPANY_IMAGE_UPLOADED',
                    table_name='CompanyImage',
                    row_id=company_image.id,
                    old_data=None,
                    new_data=new_data,
                    description=f'Company {company_image.get_image_type_display()} uploaded successfully.'
                )
            except Exception as e:
                # Log error but don't fail the upload
                print(f"Error creating audit trail: {str(e)}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CompanyImageDetailView(APIView):
    """
    API endpoint to get, update, or delete a specific company image.
    Requires VIEW_COMPANY_SETTINGS permission.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_VIEW_COMPANY_SETTINGS]
        return super().get_permissions()

    def get(self, request, pk):
        """Get a specific company image"""
        try:
            company_image = CompanyImage.objects.get(pk=pk)
            serializer = CompanyImageSerializer(company_image, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CompanyImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        """Update a company image"""
        try:
            company_image = CompanyImage.objects.get(pk=pk)
            serializer = CompanyImageSerializer(
                company_image,
                data=request.data,
                context={'request': request},
                partial=True
            )
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except CompanyImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        """Delete a company image"""
        try:
            company_image = CompanyImage.objects.get(pk=pk)
            
            # Store old data for audit trail before deletion
            old_data = CompanyImageSerializer(company_image, context={'request': request}).data
            
            settings = CompanySettings.get_settings()
            
            # If this is the active image, clear the active reference
            if settings.active_logo_id == company_image.id:
                settings.active_logo = None
                settings.save()
            elif settings.active_login_image_id == company_image.id:
                settings.active_login_image = None
                settings.save()
            
            # Get member from request user for audit trail
            try:
                member = Member.objects.get(user=request.user)
            except Member.DoesNotExist:
                member = None
            
            # Delete the image
            company_image.delete()
            
            # Create audit trail
            try:
                create_audit_trail(
                    member=member,
                    event_type='COMPANY_IMAGE_DELETED',
                    table_name='CompanyImage',
                    row_id=pk,
                    old_data=old_data,
                    new_data=None,
                    description=f'Company {company_image.get_image_type_display()} deleted successfully.'
                )
            except Exception as e:
                # Log error but don't fail the delete
                print(f"Error creating audit trail: {str(e)}")
            
            return Response({'message': 'Image deleted successfully'}, status=status.HTTP_200_OK)
        except CompanyImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)


class SetActiveImageView(APIView):
    """
    API endpoint to set an image as the active logo or login image.
    Requires VIEW_COMPANY_SETTINGS permission.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_VIEW_COMPANY_SETTINGS]
        return super().get_permissions()

    def post(self, request, pk):
        """Set an image as active"""
        try:
            company_image = CompanyImage.objects.get(pk=pk)
            settings = CompanySettings.get_settings()
            
            if company_image.image_type == 'logo':
                settings.active_logo = company_image
                settings.save()
            elif company_image.image_type == 'login_image':
                settings.active_login_image = company_image
                settings.save()
            else:
                return Response({'error': 'Invalid image type'}, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = CompanyImageSerializer(company_image, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except CompanyImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)
