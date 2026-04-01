from rest_framework import serializers
from towers.models import Tower, Unit, Vehicle

default_fields = ['id', 'unit_name', 'unit_status']


class UnitSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ['id', 'unit_name', 'unit_status']


# class TowerWithUnitsSerializer(serializers.ModelSerializer):
#     units = serializers.SerializerMethodField()

#     class Meta:
#         model = Tower
#         fields = ['id', 'tower_name', 'units']

#     def get_units(self, obj):
#         units = []
#         for floor in obj.floor_set.all():
#             units.extend(floor.unit_set.all())
#         return UnitSimpleSerializer(units, many=True).data
class TowerWithUnitsSerializer(serializers.ModelSerializer):
    units = serializers.SerializerMethodField()

    class Meta:
        model = Tower
        fields = ['id', 'tower_name', 'units']

    def get_units(self, obj):
        units_with_vehicle = set()  # Set to avoid duplicates

        for floor in obj.floor_set.all():
            for unit in floor.unit_set.all():
                if unit.vehicles.exists():  # Check if Vehicle exists for this unit
                    units_with_vehicle.add(unit)

        return UnitSimpleSerializer(list(units_with_vehicle), many=True).data


class VehicleSerializer(serializers.ModelSerializer):
    tower_name = serializers.SerializerMethodField()
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    # unit_id = serializers.IntegerField(write_only=True)  # Accept unit_id in request
    # unit_id_read = serializers.IntegerField(source='unit.id', read_only=True)
    unit_id = serializers.IntegerField(write_only=True)  # input only
    unit_id_read = serializers.IntegerField(source='unit.id', read_only=True)  # output only
    brand = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    color = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    vehicle_type = serializers.CharField(allow_blank=True, required=False, allow_null=True)

    class Meta:
        model = Vehicle
        fields = [
            'id', 'license_plate', 'vehicle_type', 'brand', 'color',
            'unit_id','unit_id_read', 'unit_name', 'tower_name', 'status'
        ]

        extra_kwargs = {
        
            'license_plate': {'required': True},
      
        }

    def get_tower_name(self, obj):
        try:
            return obj.unit.floor.tower.tower_name
        except AttributeError:
            return None

    def create(self, validated_data):
        unit_id = validated_data.pop('unit_id')
        unit = Unit.objects.get(id=unit_id)
        vehicle = Vehicle.objects.create(unit=unit, **validated_data)
        return vehicle

    def update(self, instance, validated_data):
        unit_id = validated_data.pop('unit_id', None)
        if unit_id is not None:
            instance.unit = Unit.objects.get(id=unit_id)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
