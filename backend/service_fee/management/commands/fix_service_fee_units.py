from django.core.management.base import BaseCommand
from django.db import transaction
from service_fee.models import ServiceFee
from towers.models import Tower, Unit, Floor


class Command(BaseCommand):
    help = 'Fix service fee unit references after tower unit naming changes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )
        parser.add_argument(
            '--service-fee-id',
            type=int,
            help='Fix only a specific service fee by ID',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        service_fee_id = options.get('service_fee_id')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
        
        # Get service fees to check
        if service_fee_id:
            service_fees = ServiceFee.objects.filter(id=service_fee_id, is_active=True)
            if not service_fees.exists():
                self.stdout.write(
                    self.style.ERROR(f'Service fee with ID {service_fee_id} not found or not active')
                )
                return
        else:
            service_fees = ServiceFee.objects.filter(is_active=True)
        
        self.stdout.write(f'Checking {service_fees.count()} active service fees...')
        
        fixed_count = 0
        issues_found = 0
        
        for service_fee in service_fees:
            try:
                with transaction.atomic():
                    # Check if this service fee has unit references that don't exist
                    referenced_unit_ids = list(service_fee.units.values_list('id', flat=True))
                    existing_unit_ids = list(Unit.objects.filter(id__in=referenced_unit_ids).values_list('id', flat=True))
                    missing_unit_ids = set(referenced_unit_ids) - set(existing_unit_ids)
                    
                    if missing_unit_ids:
                        issues_found += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f'Service Fee #{service_fee.id}: Found {len(missing_unit_ids)} missing unit references'
                            )
                        )
                        
                        # Try to fix by checking if this service fee references entire towers
                        tower_ids = list(service_fee.towers.values_list('id', flat=True))
                        
                        if tower_ids:
                            # This service fee is assigned to entire towers
                            # Remove the broken unit references and keep only tower references
                            if not dry_run:
                                service_fee.units.clear()
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'  Fixed: Cleared broken unit references (tower-level assignment maintained)'
                                    )
                                )
                                fixed_count += 1
                            else:
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'  Would fix: Clear broken unit references (tower-level assignment maintained)'
                                    )
                                )
                        else:
                            # This service fee has specific unit assignments
                            # Try to map missing units to current units in the same position
                            self.stdout.write(
                                self.style.WARNING(
                                    f'  Service Fee #{service_fee.id} has specific unit assignments that need manual review'
                                )
                            )
                            
                            # Get remaining valid units to understand the pattern
                            valid_units = service_fee.units.all()
                            if valid_units.exists():
                                # Group by tower to understand the assignment pattern
                                towers_with_units = {}
                                for unit in valid_units:
                                    tower_id = unit.floor.tower.id
                                    if tower_id not in towers_with_units:
                                        towers_with_units[tower_id] = []
                                    towers_with_units[tower_id].append(unit)
                                
                                # For each tower, check if we can infer the intended assignment
                                new_units_to_add = []
                                for tower_id, tower_units in towers_with_units.items():
                                    tower = Tower.objects.get(id=tower_id)
                                    
                                    # If this tower has units assigned, check if it should have all units
                                    all_tower_units = Unit.objects.filter(floor__tower=tower)
                                    assigned_count = len(tower_units)
                                    total_count = all_tower_units.count()
                                    
                                    # If more than 50% of units are assigned, assume all should be assigned
                                    if assigned_count > total_count * 0.5:
                                        missing_units = all_tower_units.exclude(id__in=[u.id for u in tower_units])
                                        new_units_to_add.extend(missing_units)
                                        
                                        self.stdout.write(
                                            f'    Tower {tower.tower_name}: Adding {missing_units.count()} missing units'
                                        )
                                
                                if new_units_to_add:
                                    if not dry_run:
                                        current_units = list(service_fee.units.all())
                                        all_units = current_units + new_units_to_add
                                        service_fee.units.set(all_units)
                                        self.stdout.write(
                                            self.style.SUCCESS(
                                                f'  Fixed: Added {len(new_units_to_add)} inferred missing units'
                                            )
                                        )
                                        fixed_count += 1
                                    else:
                                        self.stdout.write(
                                            self.style.SUCCESS(
                                                f'  Would fix: Add {len(new_units_to_add)} inferred missing units'
                                            )
                                        )
                            else:
                                # No valid units left, this service fee is completely broken
                                self.stdout.write(
                                    self.style.ERROR(
                                        f'  Service Fee #{service_fee.id} has no valid unit references - needs manual review'
                                    )
                                )
                    
                    # Also check for service fees with no units or towers assigned
                    if not service_fee.units.exists() and not service_fee.towers.exists():
                        issues_found += 1
                        self.stdout.write(
                            self.style.ERROR(
                                f'Service Fee #{service_fee.id}: No units or towers assigned - needs manual review'
                            )
                        )
                        
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error processing Service Fee #{service_fee.id}: {str(e)}'
                    )
                )
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(f'Summary:')
        self.stdout.write(f'  Service fees checked: {service_fees.count()}')
        self.stdout.write(f'  Issues found: {issues_found}')
        
        if dry_run:
            self.stdout.write(f'  Would fix: {fixed_count}')
            self.stdout.write(
                self.style.WARNING(
                    '\nRun without --dry-run to apply fixes'
                )
            )
        else:
            self.stdout.write(f'  Fixed: {fixed_count}')
            if fixed_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nSuccessfully fixed {fixed_count} service fees'
                    )
                )
        
        if issues_found > fixed_count:
            remaining_issues = issues_found - fixed_count
            self.stdout.write(
                self.style.WARNING(
                    f'\n{remaining_issues} service fees still need manual review'
                )
            )
