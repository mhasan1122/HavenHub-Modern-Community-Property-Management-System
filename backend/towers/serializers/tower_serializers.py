from rest_framework import serializers
from django.db import transaction
from towers.models import Tower, Floor, Unit, UnitDocs, Owner, Resident, UnitStaff
from user.models import Member

from rest_framework.exceptions import ValidationError





# class UnitSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Unit
#         fields = '__all__'
    
#     def update(self, instance, validated_data):
#         with transaction.atomic():
#             # Get the logged-in User from the request context
#             user = self.context.get('request').user

#             # Ensure the user is authenticated
#             if not user.is_authenticated:
#                 raise serializers.ValidationError("User is not authenticated.")
            
#             # Get the Member instance related to the logged-in User
#             member = Member.objects.get(user=user)

#             # Set the updated_by field (updated_at is handled by auto_now=True in the model)
#             instance.updated_by = member  # Update the updated_by field with the logged-in user

#             # Update the instance with the validated data
#             for attr, value in validated_data.items():
#                 setattr(instance, attr, value)

#             # Save the updated instance

          

#             instance.save()

#             return instance

class UnitDocsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitDocs
        fields = ['id', 'unit_docs', 'created_by', 'created_at', 'updated_by', 'updated_at']

    def validate_unit_docs(self, value):
        # Allowed file types
        allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif']
        file_extension = value.name.split('.')[-1].lower()

        if file_extension not in allowed_extensions:
            raise ValidationError(f"Invalid file type. Only {', '.join(allowed_extensions)} files are allowed.")
        
        # File size validation (5MB)
        if value.size > 5 * 1024 * 1024:  # 5MB limit
            raise ValidationError("File size cannot exceed 5MB.")
        
        return value

class UnitSerializer(serializers.ModelSerializer):
    docs = UnitDocsSerializer(many=True, read_only=True)
    filesToRemove = serializers.ListField(child=serializers.IntegerField(),required=False,)
    tower_name = serializers.CharField(source='floor.tower.tower_name', read_only=True)

    class Meta:
        model = Unit
        fields = '__all__'

    def update(self, instance, validated_data):
       with transaction.atomic():
        request = self.context.get('request')
        user = request.user

        if not user.is_authenticated:
            raise serializers.ValidationError("User is not authenticated.")

        member = Member.objects.get(user=user)
        instance.updated_by = member

        # Update instance fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        
        # ✅ Save new uploaded docs
        new_files = request.FILES.getlist('docs', [])
        for file_obj in new_files:
            # Validate file using serializer
            doc_serializer = UnitDocsSerializer(data={'unit_docs': file_obj})
            doc_serializer.is_valid(raise_exception=True)

            # Save validated doc
            UnitDocs.objects.create(
                unit=instance,
                created_by=member,
                updated_by=member,
                unit_docs=file_obj
            )
        filesToRemove = validated_data.pop('filesToRemove', [])
        if filesToRemove:
            for file_id in filesToRemove:
                UnitDocs.objects.filter(id=int(file_id), unit=instance).delete()  
        #  # ✅ Get files to remove (from validated_data or request.POST)
        # files_to_remove = validated_data.pop('filesToRemove', [])  # If passed in validated_data
        # # OR (if coming from request.POST)
        # files_to_remove = [int(id) for id in files_to_remove]

        # # ✅ Delete specified files
        # if files_to_remove:
        #     UnitDocs.objects.filter(id__in=files_to_remove, unit=instance).delete()       
        instance.save()
        return instance
    

class FloorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Floor
        fields = '__all__'

    def to_representation(self, instance):
        # Get the base representation from the parent
        representation = super().to_representation(instance)

        # Use prefetched units if available (from prefetch_related), otherwise query
        # This avoids N+1 queries when floors are prefetched
        if hasattr(instance, 'unit_set'):
            # Use prefetched units
            units = instance.unit_set.all()
        else:
            # Fallback to query if not prefetched (shouldn't happen in optimized views)
            units = Unit.objects.filter(floor=instance)
        
        # Only serialize essential unit fields for list view to reduce payload size
        units_data = []
        for unit in units:
            units_data.append({
                'id': unit.id,
                'unit_name': unit.unit_name,
                'unit_status': unit.unit_status,
                'status_color': unit.status_color,
            })
        
        representation['units'] = units_data

        return representation
class TowerSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all(), required=False)
    updated_by = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all(), required=False)
    photo = serializers.ImageField(required=False)
    number_of_units = serializers.ListField(child=serializers.IntegerField(), required=False)
    photo_removed = serializers.CharField(required=False)

    class Meta:
        model = Tower
        fields = [
            'id', 'tower_name', 'tower_number', 'description', 'photo', 'add_tower_number_to_unit_name',
            'units_per_floor', 'num_floors', 'num_units', 'unit_naming_type', 'created_by', 'created_at',
            'updated_by', 'updated_at', 'number_of_units','photo_removed'
        ]

    def validate_tower_name(self, value):
        """
        Validate that the tower name is unique.
        """
        # Normalize the tower name (strip whitespace and convert to lowercase for comparison)
        normalized_value = value.strip()
        
        # Check if we're updating an existing tower
        instance = self.instance
        
        # Query for existing towers with the same name (case-insensitive)
        existing_tower = Tower.objects.filter(tower_name__iexact=normalized_value)
        
        # If updating, exclude the current tower from the check
        if instance:
            existing_tower = existing_tower.exclude(id=instance.id)
        
        # If a tower with this name exists, raise validation error
        if existing_tower.exists():
            raise serializers.ValidationError("Tower name already exists. Please enter a unique name.")
        
        return normalized_value

    def to_representation(self, instance):

        representation = super().to_representation(instance)

        # Use prefetched floors if available (from prefetch_related), otherwise query
        # This avoids N+1 queries when towers are prefetched
        if hasattr(instance, 'floor_set'):
            # Use prefetched floors
            floors = instance.floor_set.all()
        else:
            # Fallback to query if not prefetched (shouldn't happen in optimized views)
            floors = Floor.objects.filter(tower=instance)
        
        floor_serializer = FloorSerializer(floors, many=True)

        representation['floors'] = floor_serializer.data

        return representation
    
    def create(self, validated_data):
        with transaction.atomic():
            # Get the logged-in User from the request context
            user = self.context.get('request').user

            # Make sure the user is authenticated
            if not user.is_authenticated:
                raise serializers.ValidationError("User is not authenticated.")
            
            # Get the Member instance related to the logged-in User
            member = Member.objects.get(user=user)

            # Automatically assign the Member instance to created_by and updated_by
            validated_data['created_by'] = member

            last_tower = Tower.objects.last()  # Get the last tower (no ordering applied)
            if last_tower:
                tower_number = last_tower.tower_number + 1
            else:
                tower_number = 1            
            validated_data['tower_number'] = tower_number

            # Create floors based on number_of_floors
            photo = validated_data.get('photo')
            num_floors = validated_data.get('num_floors', 0)
            num_units = validated_data.get('num_units', 0)
            number_of_units = validated_data.pop('number_of_units', [])
            units_per_floor = validated_data.get('units_per_floor')
            unit_naming_type = validated_data.get('unit_naming_type')
            add_tower_number_to_unit_name = validated_data.get('add_tower_number_to_unit_name')

            # Call the parent class's create method to actually create and save the Tower instance
            tower = Tower.objects.create(**validated_data)
            # Create each floor and associate it with the newly created tower
            units_per_floor_looper = 0

            if units_per_floor == "Same as Every Floor":
                number_of_units = number_of_units[units_per_floor_looper]  # Ensure number_of_units takes num_units value

                for floor_no in range(1, num_floors + 1):
                    # You can set number_of_units or any other default values
                    floor = Floor.objects.create(
                        tower=tower,
                        floor_no=floor_no,
                        number_of_units=number_of_units,  # Set this based on your needs
                        created_by=member,
                    )
                    # Create units for the floor based on the number_of_units                    
                    for unit_no in range(1, number_of_units + 1):
                        unit_name = "Default"
                        if unit_naming_type == 'Numerical':    
                            if add_tower_number_to_unit_name == 1:                           
                                unit_name = f"{tower.tower_number} - {(floor_no*100)+unit_no}"
                            else:
                                unit_name = f"{(floor_no*100)+unit_no}"               
                        elif unit_naming_type == 'Alphabetical':
                            letter_suffix = chr(65 + unit_no - 1)  # 65 is ASCII value for 'A'
                            if add_tower_number_to_unit_name == 1:                           
                                unit_name = f"{tower.tower_number} - {floor_no}{letter_suffix}"
                            else:
                                unit_name = f"{floor_no}{letter_suffix}"
                        Unit.objects.create(
                            floor=floor,
                            unit_name=unit_name,
                            # unit_status="Available",  # Set the default status or adjust it as needed
                            created_by=member, 
                        )
            elif units_per_floor == "Different":
                for floor_no in range(1, num_floors + 1):
                    # You can set number_of_units or any other default values
                    floor = Floor.objects.create(
                        tower=tower,
                        floor_no=floor_no,
                        number_of_units=number_of_units[units_per_floor_looper],  # Set this based on your needs
                        created_by=member,
                    )
                    # Create units for the floor based on the number_of_units                    
                    for unit_no in range(1, number_of_units[units_per_floor_looper] + 1):
                        unit_name = "Default"
                        if unit_naming_type == 'Numerical':
                            if add_tower_number_to_unit_name == 1:                           
                                unit_name = f"{tower.tower_number} - {(floor_no*100)+unit_no}"
                            else:
                                unit_name = f"{(floor_no*100)+unit_no}"                       
                        elif unit_naming_type == 'Alphabetical':
                            letter_suffix = chr(65 + unit_no - 1)  # 65 is ASCII value for 'A'
                            if add_tower_number_to_unit_name == 1:                           
                                unit_name = f"{tower.tower_number} - {floor_no}{letter_suffix}"
                            else:
                                unit_name = f"{floor_no}{letter_suffix}"
                        Unit.objects.create(
                            floor=floor,
                            unit_name=unit_name,
                            # unit_status="Available",  # Set the default status or adjust it as needed
                            created_by=member, 
                        )
                    units_per_floor_looper +=1
                
            return tower
    def update(self, instance, validated_data):
        with transaction.atomic():
            request = self.context.get('request')
            user = request.user

            if not user.is_authenticated:
                raise serializers.ValidationError("User is not authenticated.")

            member = Member.objects.get(user=user)

            number_of_units = validated_data.pop('number_of_units', None)
            photo_removed = validated_data.pop('photo_removed', None)
            if photo_removed == 'Removed':
                instance.photo = None

            has_structural_update = any(
                field in validated_data
                for field in [
                    'num_floors',
                    'num_units',
                    'units_per_floor',
                    'unit_naming_type',
                    'add_tower_number_to_unit_name'
                ]
            ) or number_of_units is not None

            # Update basic tower fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.updated_by = member
            instance.save()

            if not has_structural_update:
                return instance

            target_num_floors = instance.num_floors
            target_num_units = instance.num_units
            target_units_per_floor = instance.units_per_floor
            target_unit_naming_type = instance.unit_naming_type
            target_add_tower_number = instance.add_tower_number_to_unit_name

            def build_unit_name(floor_no, unit_no):
                unit_name = "Default"
                if target_unit_naming_type == 'Numerical':
                    if target_add_tower_number == 1:
                        unit_name = f"{instance.tower_number} - {(floor_no * 100) + unit_no}"
                    else:
                        unit_name = f"{(floor_no * 100) + unit_no}"
                elif target_unit_naming_type == 'Alphabetical':
                    letter_suffix = chr(65 + unit_no - 1)
                    if target_add_tower_number == 1:
                        unit_name = f"{instance.tower_number} - {floor_no}{letter_suffix}"
                    else:
                        unit_name = f"{floor_no}{letter_suffix}"
                return unit_name

            if target_units_per_floor == "Different":
                if number_of_units is None:
                    existing_floors = Floor.objects.filter(tower=instance).order_by('floor_no')
                    existing_map = {floor.floor_no: floor.number_of_units for floor in existing_floors}
                    units_per_floor_list = [
                        existing_map.get(floor_no, target_num_units)
                        for floor_no in range(1, target_num_floors + 1)
                    ]
                else:
                    units_per_floor_list = [int(value) for value in number_of_units]
                    if len(units_per_floor_list) != target_num_floors:
                        raise ValidationError({
                            "detail": "Number of units list must match the number of floors."
                        })
            else:
                if number_of_units is not None and len(number_of_units) == target_num_floors:
                    units_per_floor_list = [int(value) for value in number_of_units]
                else:
                    units_per_floor_list = [int(target_num_units) for _ in range(target_num_floors)]

            if len(units_per_floor_list) != target_num_floors:
                raise ValidationError({
                    "detail": "Invalid unit configuration for the requested number of floors."
                })

            existing_floors = list(Floor.objects.filter(tower=instance).order_by('floor_no'))
            existing_floor_nos = {floor.floor_no for floor in existing_floors}

            floors_to_remove = [floor for floor in existing_floors if floor.floor_no > target_num_floors]

            if floors_to_remove:
                for unit in Unit.objects.filter(floor__in=floors_to_remove).order_by('floor__floor_no', 'id'):
                    if (
                        Owner.objects.filter(unit=unit).exists()
                        or Resident.objects.filter(unit=unit).exists()
                        or UnitStaff.objects.filter(unit=unit).exists()
                    ):
                        raise ValidationError({
                            "detail": f"Cannot remove floor {unit.floor.floor_no}. Unit {unit.unit_name} has members assigned."
                        })

            for floor in existing_floors:
                if floor.floor_no > target_num_floors:
                    continue

                target_units = units_per_floor_list[floor.floor_no - 1]
                existing_units_qs = Unit.objects.filter(floor=floor).order_by('id')
                existing_count = existing_units_qs.count()

                if existing_count > target_units:
                    units_to_remove = list(existing_units_qs[target_units:])
                    for unit in units_to_remove:
                        if (
                            Owner.objects.filter(unit=unit).exists()
                            or Resident.objects.filter(unit=unit).exists()
                            or UnitStaff.objects.filter(unit=unit).exists()
                        ):
                            raise ValidationError({
                                "detail": f"Cannot reduce units on floor {floor.floor_no}. Unit {unit.unit_name} has members assigned."
                            })
                    Unit.objects.filter(id__in=[unit.id for unit in units_to_remove]).delete()
                elif existing_count < target_units:
                    for unit_no in range(existing_count + 1, target_units + 1):
                        Unit.objects.create(
                            floor=floor,
                            unit_name=build_unit_name(floor.floor_no, unit_no),
                            created_by=member,
                        )

                if floor.number_of_units != target_units:
                    floor.number_of_units = target_units
                    floor.updated_by = member
                    floor.save()

            for floor in floors_to_remove:
                Unit.objects.filter(floor=floor).delete()
                floor.delete()

            max_existing_floor = max(existing_floor_nos) if existing_floor_nos else 0
            for floor_no in range(max_existing_floor + 1, target_num_floors + 1):
                units_count = units_per_floor_list[floor_no - 1]
                new_floor = Floor.objects.create(
                    tower=instance,
                    floor_no=floor_no,
                    number_of_units=units_count,
                    created_by=member,
                )
                for unit_no in range(1, units_count + 1):
                    Unit.objects.create(
                        floor=new_floor,
                        unit_name=build_unit_name(floor_no, unit_no),
                        created_by=member,
                    )

            return instance
        
class UnitSideDetailSerializer(serializers.ModelSerializer):
     
    tower_name = serializers.CharField(source='floor.tower.tower_name', read_only=True)
    tower_number = serializers.IntegerField(source='floor.tower.tower_number', read_only=True)
    description = serializers.CharField(source='floor.tower.description', read_only=True)
    tower_photo = serializers.ImageField(source='floor.tower.photo', read_only=True)

    class Meta:
        model = Unit
        fields = [
            'id',
            'unit_name',
            'unit_status',
            'status_color',
            'tower_name',
            'tower_number',
            'description',
            'tower_photo'
        ]

