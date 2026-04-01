from towers.models import Tower
from towers.serializers.vehicle_serializers import TowerWithUnitsSerializer
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from towers.models import Vehicle
from towers.serializers.vehicle_serializers import VehicleSerializer,UnitSimpleSerializer
from django.db import transaction
from rest_framework import status as http_status
from rest_framework import generics

# 🚩 API: List all towers with their units (for filter dropdowns)
class TowerUnitListAPIView(APIView):
    def get(self, request):
        towers = Tower.objects.prefetch_related('unit_set').all()
        serializer = TowerWithUnitsSerializer(towers, many=True)
        return Response({
            "message": "Tower/unit list fetched successfully.",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

# 🚩 API: List all towers with their units (with floors)
class TowerWithUnitsAPIView(APIView):
    def get(self, request):
        towers = Tower.objects.prefetch_related('floor_set__unit_set').all()
        serializer = TowerWithUnitsSerializer(towers, many=True)
        return Response({'data': serializer.data}, status=status.HTTP_200_OK)
from towers.models import Tower
from towers.serializers.vehicle_serializers import TowerWithUnitsSerializer
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from towers.models import Vehicle
from towers.serializers.vehicle_serializers import VehicleSerializer,UnitSimpleSerializer
from django.db import transaction
from rest_framework import status as http_status
from rest_framework import generics

# 🚩 API: List all towers with their units (for filter dropdowns)
class TowerUnitListAPIView(APIView):
    def get(self, request):
        towers = Tower.objects.prefetch_related('unit_set').all()
        serializer = TowerWithUnitsSerializer(towers, many=True)
        return Response({
            "message": "Tower/unit list fetched successfully.",
            "data": serializer.data
        }, status=status.HTTP_200_OK)
# towers/views/vehicle_views.py





# 🚗 View 1: List All Vehicles
# class AllVehicleListAPIView(APIView):
#     def get(self, request):
#         vehicles = Vehicle.objects.all()
#         serializer = VehicleSerializer(vehicles, many=True)
#         return Response({
#             "message": "All vehicle list fetched successfully.",
#             "data": serializer.data
#         }, status=status.HTTP_200_OK)

class TowerWithUnitsAPIView(APIView):
    def get(self, request):
        # Prefetch floors and units
        towers = Tower.objects.prefetch_related('floor_set__unit_set').all()
        serializer = TowerWithUnitsSerializer(towers, many=True)
        return Response({'data': serializer.data}, status=status.HTTP_200_OK)

class AllVehicleListAPIView(APIView):
    def get(self, request):
        tower_param = request.query_params.get('tower')  # e.g. "mm1,mm2"
        unit_param = request.query_params.get('unit')    # e.g. "1,2" (unit IDs)
        status_ = request.query_params.get('status')
        numberplate = request.query_params.get('numberplate')

        vehicles = Vehicle.objects.select_related('unit__floor__tower').all()

        # Apply tower filter first to scope the search
        if tower_param:
            towers = tower_param.split(",")
            vehicles = vehicles.filter(unit__floor__tower__tower_name__in=towers)

        # Apply unit filter within the already-scoped towers
        # This ensures that if towers A, B, C are selected and unit ID "1" is selected,
        # only units with ID "1" from towers A, B, C will be returned
        if unit_param:
            unit_ids = unit_param.split(",")
            vehicles = vehicles.filter(unit__id__in=unit_ids)

        if status_:
            vehicles = vehicles.filter(status__iexact=status_)

        if numberplate:
            vehicles = vehicles.filter(license_plate__icontains=numberplate)

        serializer = VehicleSerializer(vehicles, many=True)
        return Response({
            'message': 'Filtered vehicle list fetched successfully.',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

class VehicleListView(generics.ListAPIView):
    serializer_class = VehicleSerializer

    def get_queryset(self):
        vehicles = Vehicle.objects.all()
        tower_names = self.request.GET.get('tower')
        unit_numbers = self.request.GET.get('unit')
        status = self.request.GET.get('status')
        numberplate = self.request.GET.get('numberplate')

        if tower_names:
            tower_names = [t.strip() for t in tower_names.split(',') if t.strip()]
            vehicles = vehicles.filter(unit__tower__tower_name__in=tower_names)

        if unit_numbers:
            unit_numbers = [u.strip() for u in unit_numbers.split(',') if u.strip()]
            vehicles = vehicles.filter(unit__unit_number__in=unit_numbers)

        if status:
            vehicles = vehicles.filter(status=status)

        if numberplate:
            vehicles = vehicles.filter(license_plate__icontains=numberplate)

        return vehicles

# 🚗 View 2: List Vehicles by Unit ID (passed in URL)
class UnitVehicleListAPIView(APIView):
    def get(self, request, unit_id):
        vehicles = Vehicle.objects.filter(unit_id=unit_id)
        serializer = VehicleSerializer(vehicles, many=True)
        vehicle_data = serializer.data

        for v in vehicle_data:
            v['unit_id'] = unit_id  # Inject unit_id into each object

        return Response({
            "message": f"Vehicle list for unit {unit_id} fetched successfully.",
            "data": vehicle_data
        }, status=status.HTTP_200_OK)


# 🚗 Create New Vehicle
class VehicleCreateAPIView(APIView):
    def post(self, request):
        print("🔍 DEBUG POST DATA:", request.data)  # ⬅️ Add this to check if unit_id is present

        serializer = VehicleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Vehicle created successfully.",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response({
            "message": "Vehicle creation failed.",
            "errors": serializer.errors,
            "received_data": request.data
        }, status=status.HTTP_400_BAD_REQUEST)
class VehicleDetailAPIView(APIView):
    def get(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        serializer = VehicleSerializer(vehicle)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)
    

# 🚗 Retrieve Single Vehicle
class VehicleRetrieveAPIView(APIView):
    def get(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        serializer = VehicleSerializer(vehicle)
        return Response({
            "message": "Vehicle retrieved successfully.",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class ToggleVehicleStatusView(APIView):
    def patch(self, request, pk):
        try:
            vehicle = Vehicle.objects.get(pk=pk)
        except Vehicle.DoesNotExist:
            return Response({"detail": "Vehicle not found."}, status=http_status.HTTP_404_NOT_FOUND)

        # Toggle between 'active' and 'inactive'
        vehicle.status = 'inactive' if vehicle.status == 'active' else 'active'
        vehicle.save()

        return Response({
            "message": "Status updated successfully.",
            "status": vehicle.status  # this will be 'active' or 'inactive'
        }, status=http_status.HTTP_200_OK)

# 🚗 Update Vehicle (PUT / PATCH)
class VehicleUpdateAPIView(APIView):
    def put(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        serializer = VehicleSerializer(vehicle, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Vehicle updated successfully.",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "message": "Vehicle update failed.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        serializer = VehicleSerializer(vehicle, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Vehicle updated successfully.",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "message": "Vehicle update failed.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# 🚗 Delete Vehicle
class VehicleDeleteAPIView(APIView):
    def delete(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        vehicle.delete()
        return Response({
            "message": "Vehicle deleted successfully."
        }, status=status.HTTP_204_NO_CONTENT)
