
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.db.models import Q
import re
from towers.models import Tower, Unit, Resident

# API Views for Reminder Search Functionality
class TowerSearchAPIView(APIView):
    """
    API view to search towers for reminder functionality
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        search_term = request.GET.get('search', '').strip()
        tower_ids_param = request.GET.get('tower_ids', '').strip()
        tower_ids = []
        if tower_ids_param:
            try:
                tower_ids = [int(t) for t in tower_ids_param.split(',') if t.strip()]
            except Exception:
                tower_ids = []
        
        try:
            # Debug logging
            print(f"Tower search requested with term: '{search_term}'")
            
            # Get towers based on search term
            towers = Tower.objects.all()
            print(f"Total towers in database: {towers.count()}")
            
            if search_term:
                towers = towers.filter(
                    tower_name__icontains=search_term
                ).distinct()
                print(f"Filtered towers: {towers.count()}")
            
            # Limit results to prevent too many options
        
            
            # Format response
            results = [
                {
                    'id': tower.id,
                    'name': tower.tower_name
                }
                for tower in towers
            ]
            
            # Apply natural sorting (numeric first, then alphabetical)
            def natural_sort_key(s):
                if not s: return (2, [])
                s = str(s).strip()
                if not s: return (2, [])
                
                # Check if there is ANY digit in the string
                # If it has a digit, it's considered a "numeric tower" (Priority 0)
                # If not, it's alphabetical (Priority 1)
                has_digit = any(c.isdigit() for c in s)
                prefix = 0 if has_digit else 1
                
                parts = []
                for text in re.split(r'(\d+)', s):
                    if text.isdigit():
                        parts.append((0, int(text)))
                    elif text:
                        parts.append((1, text.lower()))
                return (prefix, parts)
                
            results.sort(key=lambda x: natural_sort_key(x['name']))
            
            print(f"Returning {len(results)} results")
            
            return Response({
                'results': results,
                'count': len(results)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in tower search: {str(e)}")
            return Response({
                'error': 'Failed to fetch towers',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UnitSearchAPIView(APIView):
    """
    API view to search units for reminder functionality
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        search_term = request.GET.get('search', '').strip()
        tower_ids_param = request.GET.get('tower_ids', '').strip()
        tower_ids = []
        if tower_ids_param:
            try:
                tower_ids = [int(t) for t in tower_ids_param.split(',') if t.strip()]
            except Exception:
                tower_ids = []

        try:
            # Get units based on search term
            units = Unit.objects.select_related('floor__tower')

            # If tower ids provided, filter units by those towers
            if tower_ids:
                units = units.filter(floor__tower__id__in=tower_ids)
            
            if search_term:
                units = units.filter(
                    Q(unit_name__icontains=search_term) |
                    Q(floor__tower__tower_name__icontains=search_term)
                ).distinct()
            
            # Limit results to prevent too many options
            units = units[:20]
            
            # Format response with tower information
            results = [
                {
                    'id': unit.id,
                    'name': f"{unit.floor.tower.tower_name} - {unit.unit_name}"
                }
                for unit in units
            ]
            
            return Response({
                'results': results,
                'count': len(results)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'Failed to fetch units',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ResidentSearchAPIView(APIView):
    """
    API view to search residents for reminder functionality
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        search_term = request.GET.get('search', '').strip()
        tower_ids_param = request.GET.get('tower_ids', '').strip()
        tower_ids = []
        if tower_ids_param:
            try:
                tower_ids = [int(t) for t in tower_ids_param.split(',') if t.strip()]
            except Exception:
                tower_ids = []
        
        try:
            # Get residents based on search term
            residents = Resident.objects.select_related('member', 'unit__floor__tower')

            # If tower ids provided, filter residents by those towers
            if tower_ids:
                residents = residents.filter(unit__floor__tower__id__in=tower_ids)
            
            if search_term:
                residents = residents.filter(
                    Q(member__full_name__icontains=search_term) |
                    Q(member__user__username__icontains=search_term) |
                    Q(member__user__email__icontains=search_term) |
                    Q(unit__unit_name__icontains=search_term) |
                    Q(unit__floor__tower__tower_name__icontains=search_term)
                ).distinct()
            
            # Limit results to prevent too many options
            residents = residents[:20]
            
            # Format response with unit and tower information
            results = [
                {
                    'id': resident.id,
                    'name': f"{resident.member.full_name or resident.member.user.username} ({resident.unit.floor.tower.tower_name} - {resident.unit.unit_name})"
                }
                for resident in residents
            ]
            
            return Response({
                'results': results,
                'count': len(results)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'Failed to fetch residents',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UnitFilterListAPIView(APIView):
    """
    API view to list all units for selected towers (for dropdown filters)
    Returns units with format "Tower Name - Unit Name"
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tower_ids_param = request.GET.get('tower_ids', '').strip()
        
        try:
            # Base query - exclude units with no owner if that's the business rule
            units = Unit.objects.select_related('floor__tower').exclude(unit_status='no_owner')
            
            if tower_ids_param:
                try:
                    tower_ids = [int(t) for t in tower_ids_param.split(',') if t.strip()]
                    if tower_ids:
                        units = units.filter(floor__tower__id__in=tower_ids)
                except ValueError:
                    pass
            
            # Order results
            units = units.order_by('floor__tower__tower_name', 'unit_name')
            
            # Format results for frontend dropdown
            results = [
                {
                    'value': unit.id,
                    'label': f"{unit.floor.tower.tower_name} - {unit.unit_name}",
                    'tower_value': unit.floor.tower.id
                }
                for unit in units
            ]
            
            return Response({
                'success': True, 
                'data': results,
                'count': len(results)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False, 
                'message': f'Failed to fetch units: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)