from django.core.management.base import BaseCommand
from service_fee.models import ServiceFeeMFS, ServiceFee

class Command(BaseCommand):
    help = 'List and optionally clean up MFS accounts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Actually delete duplicate/test accounts',
        )
        parser.add_argument(
            '--provider',
            type=str,
            help='Filter by provider (bKash, Nagad, Rocket, IKcash)',
        )
        parser.add_argument(
            '--account-number',
            type=str,
            help='Filter by account number',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=== MFS Accounts in Database ==='))
        
        # Build filter
        filters = {}
        if options['provider']:
            filters['provider'] = options['provider']
        if options['account_number']:
            filters['account_number'] = options['account_number']
        
        # Get all MFS accounts
        mfs_accounts = ServiceFeeMFS.objects.filter(**filters).select_related('service_fee')
        
        if not mfs_accounts.exists():
            self.stdout.write(self.style.WARNING('No MFS accounts found with the given filters.'))
            return
        
        # Display accounts
        for account in mfs_accounts:
            status = "ACTIVE" if account.service_fee.is_active else "INACTIVE"
            self.stdout.write(
                f"ID: {account.id} | "
                f"Provider: {account.provider} | "
                f"Account: {account.account_number} | "
                f"Name: {account.account_name} | "
                f"Service Fee: #{account.service_fee.id} ({status})"
            )
        
        # Check for duplicates
        self.stdout.write(self.style.SUCCESS('\n=== Checking for Duplicates ==='))
        
        # Find duplicate provider+account combinations
        from django.db.models import Count
        duplicates = ServiceFeeMFS.objects.values('provider', 'account_number').annotate(
            count=Count('id')
        ).filter(count__gt=1)
        
        if duplicates:
            self.stdout.write(self.style.ERROR('Found duplicate provider+account combinations:'))
            for dup in duplicates:
                self.stdout.write(f"  {dup['provider']} - {dup['account_number']} (appears {dup['count']} times)")
                
                if options['clean']:
                    # Keep only the most recent one
                    accounts_to_delete = ServiceFeeMFS.objects.filter(
                        provider=dup['provider'],
                        account_number=dup['account_number']
                    ).order_by('-created_at')[1:]  # Skip the first (most recent)
                    
                    for account in accounts_to_delete:
                        self.stdout.write(f"    Deleting: {account.id} from service fee #{account.service_fee.id}")
                        account.delete()
        else:
            self.stdout.write(self.style.SUCCESS('No duplicates found.'))
        
        if options['clean']:
            self.stdout.write(self.style.SUCCESS('\nCleanup completed!'))
        else:
            self.stdout.write(self.style.WARNING('\nTo actually clean up duplicates, run with --clean flag'))
